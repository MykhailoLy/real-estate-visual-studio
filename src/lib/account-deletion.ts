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
 * prefixes are never swept wholesale. Targets survive Auth and metadata deletion. */
export async function cleanupAccountTemporaryStorage(
  db: SupabaseClient, userId: string, safeOnly = false,
  progress?: { token: string; cursor: string | null },
) {
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

  // These targets were captured atomically with lockout. Never rediscover them
  // through Auth FKs: those links disappear after hard deletion, and pending
  // metadata may already have been removed by an earlier successful sweep.
  let cursor = progress?.cursor ?? null;
  async function checkpoint(path: string | null) {
    if (!progress) throw new AccountDeletionError("cleanup_lease_required");
    const saved = await db.from("account_deletion_requests").update({ cleanup_cursor: path })
      .eq("user_id", userId).eq("lease_token", progress.token).select("user_id");
    if (saved.error || saved.data?.length !== 1) throw new AccountDeletionError("cleanup_checkpoint_failed");
  }
  for (;;) {
    let query = db.from("account_deletion_cleanup_targets").select("kind, target")
      .eq("user_id", userId).order("target").limit(100);
    if (cursor) query = query.gt("target", cursor);
    const { data, error } = await query;
    if (error || !data) throw new AccountDeletionError("cleanup_targets_unavailable");
    for (const row of data) {
      if (Date.now() >= deadline) throw new AccountDeletionError("cleanup_incomplete");
      const path = row.target;
      if (row.kind === "rework_file") {
        const parts = typeof path === "string" ? path.split("/") : [];
        if (parts.length !== 3 || parts[0] !== "rework" || !z.uuid().safeParse(parts[1]).success ||
            !parts[2] || /[\\]/.test(parts[2]) || parts[2] === "." || parts[2] === "..") {
          throw new AccountDeletionError("unexpected_reference_path");
        }
        // Defense in depth: a commercial attachment must never be removed.
        const committed = await db.from("deliverable_review_files").select("id")
          .eq("storage_path", path).eq("upload_status", "uploaded").limit(1);
        if (committed.error || !committed.data) throw new AccountDeletionError("reference_lookup_failed");
        if (committed.data.length) { await checkpoint(path); continue; }
        if ((await bucket.remove([path])).error) throw new AccountDeletionError("storage_remove_failed");
        const remaining = await bucket.list(`rework/${parts[1]}`, { search: parts[2], limit: 100 });
        if (remaining.error || !remaining.data || remaining.data.some((entry) => entry.name === parts[2])) {
          throw new AccountDeletionError("reference_cleanup_unconfirmed");
        }
        const removed = await db.from("deliverable_review_files").delete()
          .eq("storage_path", path).eq("upload_status", "pending");
        if (removed.error) throw new AccountDeletionError("reference_cleanup_failed");
      } else if (row.kind === "submission_prefix") {
        if (typeof path !== "string" || !/^(VS|VR|FP|PE|ORD)-[0-9]+$/.test(path)) {
          throw new AccountDeletionError("unexpected_order_number");
        }
        // Preserve any actual order, regardless of its status or current owner.
        const order = await db.from("orders").select("id").eq("order_number", path).maybeSingle();
        if (order.error) throw new AccountDeletionError("order_lookup_failed");
        if (!order.data) await sweep(path);
      } else {
        throw new AccountDeletionError("unexpected_cleanup_target");
      }
      // Retained targets are not deleted. Resume after completed targets on an
      // interrupted scan; reset only after a full pass so late writes are revisited.
      await checkpoint(path);
    }
    if (data.length < 100) break;
    cursor = data[data.length - 1].target;
  }
  // A full pass is complete even if a later Auth/preflight call fails. Restart
  // from the beginning on that retry to catch new arrivals behind the cursor.
  await checkpoint(null);
}

/** One account per invocation, using the existing Cron/CRON_SECRET pattern. */
export async function processAccountDeletion(db: SupabaseClient) {
  const token = crypto.randomUUID();
  const claimed = await db.rpc("claim_client_account_deletion", { p_token: token });
  if (claimed.error || !Array.isArray(claimed.data)) throw new AccountDeletionError("claim_failed");
  if (!claimed.data.length) return { processed: 0 };
  const claim = claimed.data[0];
  const userId = claim.user_id as string;
  try {
    if (claim.status !== "pending" && claim.status !== "reconciling") throw new AccountDeletionError("unexpected_deletion_state");
    let absent = claim.status === "reconciling";
    if (!absent) {
      const target = await db.auth.admin.getUserById(userId);
      absent = target.error?.code === "user_not_found" || target.error?.status === 404;
      if (!absent) {
        if (target.error || target.data.user?.id !== userId) throw new AccountDeletionError("identity_unavailable");
        const banned = await db.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
        if (banned.error) throw new AccountDeletionError("auth_lock_failed");
      }
    }
    await cleanupAccountTemporaryStorage(db, userId, false, { token, cursor: claim.cleanup_cursor ?? null });
    if (claim.status === "pending") {
      const ready = await db.rpc("check_client_account_deletion", { p_user_id: userId, p_token: token });
      if (ready.error || ready.data !== true) throw new AccountDeletionError("cleanup_precondition_failed");
      if (!absent) {
        const deleted = await db.auth.admin.deleteUser(userId, false);
        if (deleted.error) throw new AccountDeletionError("auth_delete_failed");
      }
    }
    // Token expiry is only an admission deadline. A previously admitted upload
    // can commit later, so even empty scans never make cleanup terminal.
    const now = new Date().toISOString();
    const reconciled = await db.from("account_deletion_requests").update({
      status: "reconciling", auth_deleted_at: claim.auth_deleted_at ?? now,
      cleanup_cursor: null, last_reconciled_at: now, retry_after: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      lease_token: null, lease_expires_at: null, last_error_code: null,
    }).eq("user_id", userId).eq("lease_token", token).select("user_id");
    if (reconciled.error || reconciled.data?.length !== 1) throw new AccountDeletionError("reconciliation_unconfirmed");
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
