import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

// ============================================================
// ADMIN AUTH — minimal cookie-based session
//
// We deliberately keep this stateless: there's no DB session
// table, no secret-rotation story yet. Instead each session
// cookie is `<expiryEpochSeconds>.<hmacHex>`, where the HMAC is
// computed using ADMIN_PASSWORD as the key over the expiry +
// a constant payload string. If ADMIN_PASSWORD changes, all
// existing sessions become invalid automatically.
//
// What this gives us:
//   - cookie cannot be forged without ADMIN_PASSWORD (server-only)
//   - cookie cannot outlive its embedded expiry timestamp
//   - cookie is HTTP-only + SameSite=Lax + Secure-in-prod, so it
//     never reaches client JS and isn't sent on cross-site POSTs
//
// What this does NOT give us (intentionally, per spec — "Keep it
// simple for now. Do not implement full user accounts yet."):
//   - per-user accounts
//   - revocation of an issued cookie before its expiry
//   - rate limiting (could be added if abuse becomes a real risk)
// ============================================================

export const ADMIN_COOKIE_NAME = "picchu_admin_session";

/** Session lifetime: 7 days. Long enough to be useful, short
 *  enough that a leaked cookie expires naturally. */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

/** Static payload string mixed into the HMAC. Has no security value
 *  on its own — just keeps cookies for unrelated apps from
 *  accidentally validating against ours. */
const PAYLOAD_STRING = "picchu:admin";

/**
 * Read ADMIN_PASSWORD from env. Throws if it's missing — every
 * caller of this module is in a server route or server action,
 * so failing fast is the right behaviour. We never want a
 * silently-disabled admin login that just lets everyone in.
 */
function getAdminPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || pw.length === 0) {
    throw new Error(
      "ADMIN_PASSWORD env var is not set. Admin auth cannot function."
    );
  }
  return pw;
}

/** True if ADMIN_PASSWORD is configured. Used by login UI to
 *  render a clear "not configured" message instead of an opaque
 *  500 when the deploy is missing the env var. */
export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** HMAC-SHA256 over `${expiry}:${PAYLOAD_STRING}`, hex-encoded. */
function signExpiry(expirySeconds: number, password: string): string {
  return createHmac("sha256", password)
    .update(`${expirySeconds}:${PAYLOAD_STRING}`)
    .digest("hex");
}

/** Constant-time hex compare. Returns false on length mismatch
 *  rather than throwing the way `timingSafeEqual` would. */
function safeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * Compare a user-submitted password to ADMIN_PASSWORD using a
 * timing-safe comparison. Returns false if the env var is missing
 * (no implicit "auth disabled" behaviour).
 */
export function verifyAdminPassword(submitted: string): boolean {
  let expected: string;
  try {
    expected = getAdminPassword();
  } catch {
    return false;
  }
  if (typeof submitted !== "string") return false;
  if (submitted.length === 0) return false;
  // We compare bytes directly — passwords here are short user
  // input, so there's no padding hazard.
  const a = Buffer.from(submitted, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Build a fresh, signed session cookie value with a 7-day TTL.
 * Includes a small random nonce so two cookies issued in the
 * same second still differ — purely cosmetic, the HMAC already
 * binds the cookie to its expiry.
 */
export function buildSessionCookieValue(): {
  value: string;
  maxAge: number;
} {
  const password = getAdminPassword();
  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const sig = signExpiry(expiry, password);
  // Nonce defends against accidental cookie collisions in shared
  // dev environments; it's not part of the signature.
  const nonce = randomBytes(6).toString("hex");
  return {
    value: `${expiry}.${sig}.${nonce}`,
    maxAge: SESSION_TTL_SECONDS,
  };
}

/**
 * Verify a cookie value. Returns true only if:
 *   - the cookie has the expected `<expiry>.<sig>(.nonce)?` shape
 *   - the embedded expiry is in the future
 *   - the HMAC matches a fresh signature computed with the
 *     current ADMIN_PASSWORD
 */
export function verifySessionCookieValue(
  raw: string | undefined | null
): boolean {
  if (!raw) return false;
  const parts = raw.split(".");
  if (parts.length < 2) return false;
  const [expiryStr, sig] = parts;

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry <= 0) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds >= expiry) return false;

  let password: string;
  try {
    password = getAdminPassword();
  } catch {
    return false;
  }
  const expected = signExpiry(expiry, password);
  return safeHexEqual(sig, expected);
}

/**
 * Read the current request's session cookie and return whether
 * it's a valid admin session. Server-side only.
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const cookie = store.get(ADMIN_COOKIE_NAME);
  return verifySessionCookieValue(cookie?.value);
}

/**
 * Cookie attributes used everywhere we set or clear the admin
 * cookie. Centralised so `set` and `delete` agree on path/domain.
 *
 * - HTTP-only: never readable by client JS
 * - SameSite=Lax: allows top-level GET navigations (so an admin
 *   following a link from email still has a session) but blocks
 *   cross-site POSTs
 * - Secure in production only (so local http://localhost works
 *   during development)
 * - Path "/" so admin routes and API routes both see it
 */
export function adminCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
