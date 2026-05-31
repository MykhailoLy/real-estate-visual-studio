// ============================================================
// CLIENT DELIVERABLES — server-side helpers (Phase 5B)
//
// Reads order_deliverables rows and generates short-lived
// signed download URLs for the `deliverables` Storage bucket.
//
// ⚠️  SECURITY CONTRACT (same as client-orders.ts)
// ─────────────────────────────────────────────────────────
// • `email` MUST come from getClientUser() on the server.
//   NEVER accept email from URL params, query string, cookies,
//   localStorage, or request body.
// • Ownership is checked by joining order_deliverables → orders
//   and filtering WHERE orders.client_email = verified email.
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
 * Returns all deliverables for orders owned by `email`.
 * Ownership enforced by JOIN: orders.client_email = email.
 *
 * Returns [] on missing env vars or any DB error.
 */
export async function getDeliverablesByClientEmail(
  email: string
): Promise<ClientDeliverable[]> {
  if (!email) {
    console.warn("[client-deliverables] Called with empty email.");
    return [];
  }

  let supabase;
  try { supabase = makeClient(); } catch (e) {
    console.warn(String(e));
    return [];
  }

  try {
    // Join through orders to enforce email ownership server-side.
    // SELECT only safe columns — storage_path excluded.
    const { data, error } = await supabase
      .from("order_deliverables")
      .select(
        "id, order_id, order_number, item_index, " +
        "filename, file_size, mime_type, uploaded_at, " +
        "orders!inner(client_email)"
      )
      .eq("orders.client_email", email)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("[client-deliverables] Fetch error:", error.message);
      return [];
    }

    return ((data ?? []) as unknown as Array<ClientDeliverable & {
      orders: { client_email: string }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    }>).map(({ orders: _orders, ...row }) => row);
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

/**
 * Generates a short-lived signed download URL for one deliverable.
 *
 * SECURITY:
 *   - deliverableId comes from the URL (untrusted).
 *   - email comes from getClientUser() (trusted).
 *   - Both are cross-referenced in a single JOIN query.
 *   - Returns null when ownership check fails — indistinguishable
 *     from "not found" to prevent information leakage.
 *   - The storage_path is never returned to the caller.
 *   - Signed URL is generated with { download: filename } so that
 *     Supabase Storage sets Content-Disposition: attachment, which
 *     forces browsers to download rather than open the file.
 */
export async function getDeliverableDownloadUrl(
  deliverableId: string,
  email: string
): Promise<DeliverableDownloadResult | null> {
  if (!deliverableId || !email) return null;

  let supabase;
  try { supabase = makeClient(); } catch (e) {
    console.warn(String(e));
    return null;
  }

  try {
    // Ownership-guarded query: deliverable + order email in one shot.
    // Also fetch filename so we can pass it to createSignedUrl.
    const { data, error } = await supabase
      .from("order_deliverables")
      .select("storage_path, filename, orders!inner(client_email)")
      .eq("id", deliverableId)
      .eq("orders.client_email", email)      // ← ownership check
      .maybeSingle();

    if (error || !data) return null;

    const { storage_path: storagePath, filename } =
      data as unknown as { storage_path: string; filename: string };

    // Generate signed URL with forced download filename so Storage sets
    // Content-Disposition: attachment — never stored, never logged, 300s TTL.
    const { data: signed, error: urlErr } = await supabase
      .storage
      .from(DELIVERABLES_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, {
        download: filename,
      });

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
