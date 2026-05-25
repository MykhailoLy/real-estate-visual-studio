import { Resend } from "resend";

// ============================================================
// Lazy Resend client
// ----------------------------------------------------------------
// We construct the client on first use rather than at module load.
// Two reasons:
//   1) /api/order imports this module and is part of the production
//      bundle. Constructing at module top level would throw during
//      cold start in environments where RESEND_API_KEY is absent
//      (e.g. preview deployments without secrets, local builds).
//   2) Order submission must NEVER fail just because email is
//      unavailable. By isolating the env check inside a getter, the
//      caller gets a clear { ok: false } and continues.
// ============================================================

let cachedClient: Resend | null = null;

export type ResendClientResult =
  | { ok: true; client: Resend }
  | { ok: false; reason: string };

/**
 * Returns the shared Resend client, or an explanatory failure if the
 * service is not configured. Never throws.
 */
export function getResendClient(): ResendClientResult {
  if (cachedClient) return { ok: true, client: cachedClient };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "RESEND_API_KEY is not set" };
  }

  try {
    cachedClient = new Resend(apiKey);
    return { ok: true, client: cachedClient };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Failed to construct Resend client",
    };
  }
}

/**
 * The verified sending address. Allows ops to re-route via env
 * without code changes; defaults to the address documented in the
 * project's .env.example so dev/staging Just Work.
 */
export function getFromAddress(): string {
  const fromEmail = process.env.FROM_EMAIL || "orders@picchuspot.com";
  return `PicchuSpot <${fromEmail}>`;
}

/**
 * Fallback inbox for admin notifications when ADMIN_EMAIL is not set
 * — keeps notifications going to the documented default rather than
 * dropping them on the floor.
 */
export function getAdminAddress(): string {
  return process.env.ADMIN_EMAIL || "orders@picchuspot.com";
}
