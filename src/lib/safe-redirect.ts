// ============================================================
// SAFE REDIRECT — internal-path sanitizer
//
// Used everywhere a redirectTo / next destination is read from
// user-controlled input (login, signup, /auth/callback, profile
// onboarding). Guarantees we only ever redirect to an INTERNAL
// path, never to an attacker-controlled external URL.
//
// Allowed:   "/dashboard/orders/new/virtual-staging"
// Rejected:  "//evil.com", "https://evil.com", "javascript:...",
//            "\\evil.com", "" / null  → fallback
//
// Pure + isomorphic (safe in both client and server code)..
// ============================================================

/** Default landing when no valid internal destination is provided. */
export const DEFAULT_REDIRECT = "/dashboard";

/**
 * Returns `raw` only if it is a safe internal path:
 *   - starts with a single "/"
 *   - does NOT start with "//" (protocol-relative open redirect)
 *   - contains no backslashes (some browsers treat "\" as "/")
 *   - contains no control characters
 * Otherwise returns `fallback`.
 */
export function safeInternalPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT,
): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (value.length === 0) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
