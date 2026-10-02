// ============================================================
// CLIENT DELIVERABLES — server-side helpers (Phase 5B)
//
// Reads order_deliverables rows and generates short-lived signed URLs for
// originals or persistent previews in the `deliverables` Storage bucket.
//
// ⚠️  SECURITY CONTRACT (see src/lib/order-ownership.ts)
// ─────────────────────────────────────────────────────────
// • `ownership` MUST come from getClientUser() on the server.
//   NEVER accept identity from URL params, query string, cookies,
//   localStorage, or request body.
// • Ownership = orders.user_id === user id, OR (user_id IS NULL AND
//   client_email matches the verified session email). Enforced via
//   getOwnedOrderIds() for lists and isOrderOwned() for single rows.
// • storage_path is NEVER forwarded to the client.
// • Signed URLs are generated server-side with a 300-second TTL.
//
// Server-only.  Never import from a "use client" file.
// ============================================================

import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  DELIVERABLES_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from "@/lib/deliverables-config";
import { getOwnedOrderIds } from "@/lib/client-orders";
import { isOrderOwned, type OrderOwnership } from "@/lib/order-ownership";
import { getOrCreatePrivateImagePreview } from "@/lib/private-image-preview";

// Re-export so callers that already import from this module keep working.
export {
  DELIVERABLES_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from "@/lib/deliverables-config";
export {
  ADMIN_DELIVERABLE_MAX_BYTES,
  ADMIN_DELIVERABLE_MAX_MB,
  ALLOWED_DELIVERABLE_MIME_TYPES,
  ALLOWED_DELIVERABLE_EXTENSIONS,
  buildDeliverablePath,
} from "@/lib/deliverables-config";

// ── Types ─────────────────────────────────────────────────────

/** Safe subset of order_deliverables exposed to the client layer.
 *  storage_path is intentionally excluded. */
export interface ClientDeliverable {
  id: string;
  order_id: string;
  order_number: string;
  item_index: number | null;
  filename: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

// ── Private factory ───────────────────────────────────────────

function makeClient() {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "[client-deliverables] Missing NEXT_PUBLIC_SUPABASE_URL or " +
      "SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// ── Public API ────────────────────────────────────────────────

/**
 * Returns all deliverables for orders owned by the authenticated account.
 * Ownership is resolved via getOwnedOrderIds() (user_id OR legacy
 * NULL+email) and the query is scoped with `order_id IN (ownedIds)`.
 *
 * Returns [] on missing env vars or any DB error.
 */
export async function getDeliverablesForClient(
  ownership: OrderOwnership
): Promise<ClientDeliverable[]> {
  if (!ownership?.userId || !ownership?.email) {
    console.warn("[client-deliverables] Called without a valid ownership.");
    return [];
  }

  let supabase;
  try { supabase = makeClient(); } catch (e) {
    console.warn(String(e));
    return [];
  }

  try {
    // Resolve the account's owned order IDs first, then scope the
    // deliverables query to them. This applies the full ownership rule
    // (user_id, or legacy NULL+email) without relying on join filters.
    const ownedOrderIds = await getOwnedOrderIds(ownership);
    if (ownedOrderIds.length === 0) return [];

    // SELECT only safe columns — storage_path excluded.
    const { data, error } = await supabase
      .from("order_deliverables")
      .select(
        "id, order_id, order_number, item_index, " +
        "filename, file_size, mime_type, uploaded_at"
      )
      .in("order_id", ownedOrderIds)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("[client-deliverables] Fetch error:", error.message);
      return [];
    }

    return (data ?? []) as unknown as ClientDeliverable[];
  } catch (err) {
    console.error("[client-deliverables] Unexpected error:", err);
    return [];
  }
}

/** Result returned from getDeliverableDownloadUrl. */
export interface DeliverableDownloadResult {
  signedUrl: string;
  filename: string;
}

interface DeliverableSignedUrlOptions {
  download?: boolean;
}

/**
 * Generates a short-lived signed preview or download URL for one deliverable.
 *
 * SECURITY:
 *   - deliverableId comes from the URL (untrusted).
 *   - email comes from getClientUser() (trusted).
 *   - Both are cross-referenced in a single JOIN query.
 *   - Returns null when ownership check fails — indistinguishable
 *     from "not found" to prevent information leakage.
 *   - The storage_path is never returned to the caller.
 *   - Download requests always sign the original with { download: filename }.
 *   - Preview requests use a persistent derivative when available and fall
 *     back to an inline signed URL for the original.
 */
export async function getDeliverableDownloadUrl(
  deliverableId: string,
  ownership: OrderOwnership,
  options: DeliverableSignedUrlOptions = { download: true }
): Promise<DeliverableDownloadResult | null> {
  if (!deliverableId || !ownership?.userId || !ownership?.email) return null;

  let supabase;
  try { supabase = makeClient(); } catch (e) {
    console.warn(String(e));
    return null;
  }

  try {
    // Fetch the deliverable joined to its order, then enforce ownership
    // in JS via isOrderOwned() (user_id, or legacy NULL+email).
    const { data, error } = await supabase
      .from("order_deliverables")
      .select(
        "storage_path, filename, file_size, mime_type, " +
        "orders!inner(user_id, client_email, account_deleted_at)"
      )
      .eq("id", deliverableId)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as unknown as {
      storage_path: string;
      filename: string;
      file_size: number;
      mime_type: string;
      orders: { user_id: string | null; client_email: string | null };
    };

    // Ownership check — wrong owner is indistinguishable from not found.
    if (!isOrderOwned(row.orders, ownership)) return null;

    const {
      storage_path: storagePath,
      filename,
      file_size: fileSize,
      mime_type: mimeType,
    } = row;

    const previewPath = options.download
      ? null
      : await getOrCreatePrivateImagePreview(supabase, DELIVERABLES_BUCKET, {
          storagePath,
          filename,
          fileSize,
          mimeType,
        });
    const signedPath = previewPath ?? storagePath;

    // Only original downloads receive Content-Disposition: attachment.
    // Preview URLs remain inline, short-lived, and are never logged.
    const signedOptions = options.download ? { download: filename } : undefined;
    const { data: signed, error: urlErr } = await supabase
      .storage
      .from(DELIVERABLES_BUCKET)
      .createSignedUrl(signedPath, SIGNED_URL_TTL_SECONDS, signedOptions);

    if ((urlErr || !signed?.signedUrl) && previewPath) {
      const { data: originalSigned, error: originalUrlErr } = await supabase
        .storage
        .from(DELIVERABLES_BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
      if (originalUrlErr || !originalSigned?.signedUrl) {
        console.error(
          "[client-deliverables] Original preview URL fallback error:",
          originalUrlErr?.message,
        );
        return null;
      }
      return { signedUrl: originalSigned.signedUrl, filename };
    }

    if (urlErr || !signed?.signedUrl) {
      console.error("[client-deliverables] Signed URL error:", urlErr?.message);
      return null;
    }

    return { signedUrl: signed.signedUrl, filename };
  } catch (err) {
    console.error("[client-deliverables] Unexpected error in getDeliverableDownloadUrl:", err);
    return null;
  }
}

// buildDeliverablePath is re-exported from deliverables-config above.
