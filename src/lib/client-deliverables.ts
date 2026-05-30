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

import { createClient } from "@supabase/supabase-js";

// ── Constants ─────────────────────────────────────────────────

/** Private Supabase Storage bucket that holds finished deliverables. */
export const DELIVERABLES_BUCKET = "deliverables";

/** Signed URL TTL in seconds (5 minutes). */
export const SIGNED_URL_TTL_SECONDS = 300;

/** Max file size for admin deliverable uploads (200 MB). */
export const ADMIN_DELIVERABLE_MAX_BYTES = 200 * 1024 * 1024;
export const ADMIN_DELIVERABLE_MAX_MB = ADMIN_DELIVERABLE_MAX_BYTES / (1024 * 1024);

/** MIME types accepted for deliverable uploads. */
export const ALLOWED_DELIVERABLE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  // Some OS/browsers report generic octet-stream for ZIP files
  "application/octet-stream",
] as const;

/** Allowed file extensions (used to verify octet-stream uploads). */
export const ALLOWED_DELIVERABLE_EXTENSIONS = [
  "jpg", "jpeg", "png", "webp", "tif", "tiff", "pdf", "zip",
] as const;

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
 */
export async function getDeliverableDownloadUrl(
  deliverableId: string,
  email: string
): Promise<string | null> {
  if (!deliverableId || !email) return null;

  let supabase;
  try { supabase = makeClient(); } catch (e) {
    console.warn(String(e));
    return null;
  }

  try {
    // Ownership-guarded query: deliverable + order email in one shot.
    const { data, error } = await supabase
      .from("order_deliverables")
      .select("storage_path, orders!inner(client_email)")
      .eq("id", deliverableId)
      .eq("orders.client_email", email)      // ← ownership check
      .maybeSingle();

    if (error || !data) return null;

    const storagePath = (data as unknown as { storage_path: string }).storage_path;

    // Generate signed URL — never stored, never logged, 300s TTL.
    const { data: signed, error: urlErr } = await supabase
      .storage
      .from(DELIVERABLES_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (urlErr || !signed?.signedUrl) {
      console.error("[client-deliverables] Signed URL error:", urlErr?.message);
      return null;
    }

    return signed.signedUrl;
  } catch (err) {
    console.error("[client-deliverables] Unexpected error in getDeliverableDownloadUrl:", err);
    return null;
  }
}

// ── Path builder (used by admin upload route) ─────────────────

/**
 * Constructs a safe storage path for a deliverable file.
 * Path is built server-side only — never accepts raw client input.
 *
 * Format: <orderNumber>/<timestamp>-<safe-filename>
 */
export function buildDeliverablePath(
  orderNumber: string,
  originalFilename: string
): string {
  // Strip path separators and non-safe chars from the filename
  const safeBase = originalFilename
    .replace(/^.*[\\/]/, "")         // strip any path prefix
    .replace(/[^a-zA-Z0-9._-]/g, "_") // replace unsafe chars
    .slice(0, 100);                    // cap length
  const ts = Date.now();
  return `${orderNumber}/${ts}-${safeBase}`;
}
