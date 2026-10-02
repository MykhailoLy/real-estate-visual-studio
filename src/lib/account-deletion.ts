import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const AccountDeletionBody = z.object({ confirmationEmail: z.string().min(1).max(320) }).strict();

export class AccountDeletionError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 503) { super(code); this.code = code; this.status = status; }
}

/** Absence must be confirmed. Missing migrations/outages fail closed. */
export async function assertClientAccountActive(db: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await db.from("account_deletion_requests")
    .select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw new AccountDeletionError("account_state_unavailable");
  if (data) throw new AccountDeletionError("account_deletion_pending", 403);
}

/** Check again after signing: an in-flight signer must not release a capability
 * after deletion starts. Any URL already released was signed before requested_at
 * and expires within Supabase's two-hour TTL. Unreleased tokens are discarded. */
export async function createClientSignedUploadUrl(
  db: SupabaseClient, userId: string, bucket: string, path: string,
  options?: { upsert: boolean },
) {
  await assertClientAccountActive(db, userId);
  const signed = await db.storage.from(bucket).createSignedUploadUrl(path, options);
  await assertClientAccountActive(db, userId);
  return signed;
}

export async function requestAccountDeletion(db: SupabaseClient, userId: string, body: unknown) {
  const parsed = AccountDeletionBody.safeParse(body);
  if (!parsed.success) throw new AccountDeletionError("invalid_confirmation", 400);
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user || data.user.id !== userId || data.user.is_anonymous || !data.user.email) {
    throw new AccountDeletionError("identity_unavailable");
  }
  if (parsed.data.confirmationEmail !== data.user.email) {
    throw new AccountDeletionError("confirmation_mismatch", 400);
  }
  // The RPC rechecks Auth under a lock, serializes order ownership changes, and
  // persists both the lockout and historical tombstones atomically.
  const pending = await db.rpc("request_client_account_deletion", {
    p_user_id: data.user.id, p_confirmation_email: data.user.email,
  });
  if (pending.error || typeof pending.data !== "string") throw new AccountDeletionError("request_unconfirmed");

  // Lockout is durable even if Auth/Storage is unavailable. Never report that
  // physical deletion completed; the worker retries every remaining step.
  try {
    const banned = await db.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    if (banned.error) throw new AccountDeletionError("auth_lock_failed");
    await cleanupAccountTemporaryStorage(db, userId, true);
  } catch {
    // No provider details, email, tokens or storage paths enter logs/responses.
    console.warn("[account-deletion] initial cleanup deferred to worker");
  }
  return { status: "pending" as const };
}

/** Only known account-temporary namespaces. Commercial order/rework/deliverable
 * prefixes are never swept wholesale. A failed sweep preserves Auth and retries. */
export async function cleanupAccountTemporaryStorage(db: SupabaseClient, userId: string, safeOnly = false) {
  if (!z.uuid().safeParse(userId).success) throw new AccountDeletionError("invalid_account");
  const deadline = Date.now() + 35_000;
  const bucket = db.storage.from("order-files");
  async function sweep(prefix: string, depth = 0): Promise<void> {
    if (Date.now() >= deadline || depth > 6) throw new AccountDeletionError("cleanup_incomplete");
    for (;;) {
      if (Date.now() >= deadline) throw new AccountDeletionError("cleanup_incomplete");
      const { data, error } = await bucket.list(prefix, { limit: 100, sortBy: { column: "name", order: "asc" } });
      if (error || !data) throw new AccountDeletionError("storage_list_failed");
      if (data.length === 0) return;
      const paths: string[] = [];
      for (const entry of data) {
        if (!entry.name || /[\\/]/.test(entry.name) || entry.name === "." || entry.name === "..") {
          throw new AccountDeletionError("unexpected_storage_path");
        }
        const path = `${prefix}/${entry.name}`;
        if (entry.id) paths.push(path);
        else await sweep(path, depth + 1);
      }
      if (paths.length && (await bucket.remove(paths)).error) throw new AccountDeletionError("storage_remove_failed");
      // Read again from offset zero: deletion shifts pagination. Confirmation of
      // an empty prefix catches missing/partial removals and permits crash retries.
    }
  }

  if (safeOnly) {
    // Converted drafts already copied commercial files elsewhere; deleted and
    // expired drafts cannot be finalized. Active/converting work is left alone.
    const { data, error } = await db.from("order_drafts").select("id")
      .eq("user_id", userId).in("status", ["converted", "deleted", "expired"]).limit(20);
    if (error || !data) throw new AccountDeletionError("draft_lookup_failed");
    for (const draft of data) {
      if (!z.uuid().safeParse(draft.id).success) throw new AccountDeletionError("unexpected_draft");
      await sweep(`drafts/${userId}/${draft.id}`);
    }
    return;
  }

  const live = await db.from("order_submissions").select("submission_id")
    .eq("user_id", userId).eq("status", "processing")
    .gt("lease_expires_at", new Date().toISOString()).limit(1);
  if (live.error || !live.data || live.data.length) throw new AccountDeletionError("submission_in_progress");
  await sweep(`drafts/${userId}`);
  await sweep(`pending/${userId}`);

  // Incomplete rework attachments are temporary. Uploaded attachments are part
  // of the commercial record and are retained with their orders.
  for (;;) {
    const files = await db.from("deliverable_review_files")
      .select("id, review_id, storage_path, orders!inner(user_id)")
      .eq("orders.user_id", userId).eq("upload_status", "pending").limit(100);
    if (files.error || !files.data) throw new AccountDeletionError("reference_lookup_failed");
    if (!files.data.length) break;
    const paths = files.data.map((file) => {
      if (!z.uuid().safeParse(file.review_id).success || typeof file.storage_path !== "string" ||
          !file.storage_path.startsWith(`rework/${file.review_id}/`) ||
          !/^[^/\\]+$/.test(file.storage_path.slice(`rework/${file.review_id}/`.length))) {
        throw new AccountDeletionError("unexpected_reference_path");
      }
      return file.storage_path as string;
    });
    if ((await bucket.remove(paths)).error) throw new AccountDeletionError("storage_remove_failed");
    for (const path of paths) {
      const slash = path.lastIndexOf("/");
      const filename = path.slice(slash + 1);
      const remaining = await bucket.list(path.slice(0, slash), { search: filename, limit: 100 });
      if (remaining.error || !remaining.data || remaining.data.some((entry) => entry.name === filename)) {
        throw new AccountDeletionError("reference_cleanup_unconfirmed");
      }
    }
    const removed = await db.from("deliverable_review_files").delete()
      .in("id", files.data.map((file) => file.id)).eq("upload_status", "pending");
    if (removed.error) throw new AccountDeletionError("reference_cleanup_failed");
    if (Date.now() >= deadline) throw new AccountDeletionError("cleanup_incomplete");
  }

  // A failed submit can have copied files to a reserved order number without
  // committing an order. Preserve any actual order, regardless of its status.
  let cursor: string | null = null;
  for (;;) {
    let query = db.from("order_submissions").select("submission_id, reserved_order_id, reserved_order_number")
      .eq("user_id", userId).eq("status", "processing").order("submission_id").limit(100);
    if (cursor) query = query.gt("submission_id", cursor);
    const { data, error } = await query;
    if (error || !data) throw new AccountDeletionError("submission_lookup_failed");
    for (const row of data) {
      const order = await db.from("orders").select("id").eq("order_number", row.reserved_order_number).maybeSingle();
      if (order.error) throw new AccountDeletionError("order_lookup_failed");
      if (order.data) continue;
      if (typeof row.reserved_order_number !== "string" || !/^[a-zA-Z0-9_-]+$/.test(row.reserved_order_number)) {
        throw new AccountDeletionError("unexpected_order_number");
      }
      await sweep(row.reserved_order_number);
    }
    if (data.length < 100) break;
    cursor = data[data.length - 1].submission_id;
  }
}

/** One account per invocation, using the existing Cron/CRON_SECRET pattern. */
export async function processAccountDeletion(db: SupabaseClient) {
  const token = crypto.randomUUID();
  const claimed = await db.rpc("claim_client_account_deletion", { p_token: token });
  if (claimed.error || !Array.isArray(claimed.data)) throw new AccountDeletionError("claim_failed");
  if (!claimed.data.length) return { processed: 0 };
  const userId = claimed.data[0].user_id as string;
  try {
    const target = await db.auth.admin.getUserById(userId);
    const absent = target.error?.code === "user_not_found" || target.error?.status === 404;
    if (!absent) {
      if (target.error || target.data.user?.id !== userId) throw new AccountDeletionError("identity_unavailable");
      const banned = await db.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      if (banned.error) throw new AccountDeletionError("auth_lock_failed");
    }
    // Reconcile temporary namespaces even after a lost Auth response or an
    // external Auth deletion. Absence alone is not evidence of Storage cleanup.
    await cleanupAccountTemporaryStorage(db, userId);
    const ready = await db.rpc("check_client_account_deletion", { p_user_id: userId, p_token: token });
    if (ready.error || ready.data !== true) throw new AccountDeletionError("cleanup_precondition_failed");
    if (!absent) {
      const deleted = await db.auth.admin.deleteUser(userId, false);
      if (deleted.error) throw new AccountDeletionError("auth_delete_failed");
    }
    const completed = await db.from("account_deletion_requests").update({
      status: "completed", completed_at: new Date().toISOString(),
      lease_token: null, lease_expires_at: null, last_error_code: null,
    }).eq("user_id", userId).eq("lease_token", token).select("user_id");
    if (completed.error || completed.data?.length !== 1) throw new AccountDeletionError("completion_unconfirmed");
    return { processed: 1 };
  } catch (error) {
    const code = error instanceof AccountDeletionError ? error.code : "cleanup_failed";
    const retry = await db.from("account_deletion_requests").update({
      lease_token: null, lease_expires_at: null, last_error_code: code,
      retry_after: new Date(Date.now() + 15 * 60_000).toISOString(),
    }).eq("user_id", userId).eq("lease_token", token);
    if (retry.error) console.warn("[account-deletion] retry write failed; lease will expire");
    throw new AccountDeletionError(code);
  }
}
