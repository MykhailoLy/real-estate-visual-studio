// ============================================================
// CLIENT AUTH — Supabase Auth helpers
//
// Uses @supabase/supabase-js v2 without @supabase/ssr.
//
// Browser-side: getSupabaseBrowser() from the existing supabase.ts
// is used for all auth actions (signIn, signUp, signOut, etc.).
//
// Server-side session detection: Supabase stores the session in
// localStorage on the client. For server-side protection in
// Next.js App Router we read the sb-<project>-auth-token cookie
// that Supabase sets automatically, decode the JWT payload, and
// verify the expiry. We intentionally do NOT verify the signature
// here — that's Supabase's job when the token is used against the
// API. We use the decoded payload only to decide whether to redirect.
//
// This is the standard lightweight approach when @supabase/ssr is
// not available. Full cryptographic verification is not needed for
// redirect logic — the worst case is that a tampered token passes
// the redirect check but then fails against Supabase when real data
// is requested.
// ============================================================

import { cookies } from "next/headers";

// ── Types ────────────────────────────────────────────────────

export interface ClientUser {
  id: string;
  email: string;
  /** Display name: user_metadata.full_name, or email prefix as fallback */
  displayName: string;
  /** First word of displayName */
  firstName: string;
}

// ── JWT decode (no signature verification) ────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url → base64 → Buffer
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── Cookie name helpers ───────────────────────────────────────

/**
 * Supabase stores the session JWT in a cookie named
 * `sb-<project-ref>-auth-token` (or split across chunked cookies
 * for large JWTs). We search for any cookie whose name starts with
 * "sb-" and ends with "-auth-token".
 */
function findSupabaseCookieValue(
  cookieStore: Awaited<ReturnType<typeof cookies>>
): string | null {
  const all = cookieStore.getAll();

  // Look for the main token cookie
  const main = all.find(
    (c) =>
      c.name.startsWith("sb-") &&
      (c.name.endsWith("-auth-token") || c.name.endsWith("-auth-token.0"))
  );
  if (!main) return null;

  // The value may be a JSON string or a raw JWT
  const raw = main.value;
  if (!raw) return null;

  // Supabase sometimes stores {"access_token":"...","refresh_token":"...",...}
  try {
    const parsed = JSON.parse(raw) as { access_token?: string };
    if (parsed?.access_token) return parsed.access_token;
  } catch {
    // Not JSON — assume the cookie value is the JWT directly
  }

  // If it looks like a JWT (three dot-separated parts) use it as-is
  if (raw.split(".").length === 3) return raw;

  return null;
}

// ── Server-side session reader ────────────────────────────────

/**
 * Server-side only. Reads the Supabase session cookie and returns
 * a lightweight ClientUser if a valid, non-expired JWT is present.
 * Returns null if unauthenticated or the token is expired.
 *
 * Call this from server components and API routes to get the
 * current user without a network round-trip to Supabase.
 */
export async function getClientUser(): Promise<ClientUser | null> {
  try {
    const store = await cookies();
    const token = findSupabaseCookieValue(store);
    if (!token) return null;

    const payload = decodeJwtPayload(token);
    if (!payload) return null;

    // Check expiry
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    if (exp > 0 && Math.floor(Date.now() / 1000) >= exp) return null;

    // Extract identity fields
    const sub = typeof payload.sub === "string" ? payload.sub : "";
    const email = typeof payload.email === "string" ? payload.email : "";
    if (!sub || !email) return null;

    // Prefer full_name from user_metadata, fall back to email prefix
    const meta =
      payload.user_metadata &&
      typeof payload.user_metadata === "object"
        ? (payload.user_metadata as Record<string, unknown>)
        : {};
    const rawName =
      typeof meta.full_name === "string" && meta.full_name.trim()
        ? meta.full_name.trim()
        : email.split("@")[0];

    const displayName = rawName;
    const firstName = rawName.split(" ")[0];

    return { id: sub, email, displayName, firstName };
  } catch {
    return null;
  }
}

/**
 * Convenience: returns true when a valid, non-expired session exists.
 * Used by middleware and server components for redirect checks.
 */
export async function isClientAuthenticated(): Promise<boolean> {
  const user = await getClientUser();
  return user !== null;
}

// ── Display helpers ───────────────────────────────────────────
// getInitials() lives in src/lib/client-auth-utils.ts so client
// components can import it without pulling in next/headers.
// Re-export here for server-side callers that want everything
// from one import.
export { getInitials } from "./client-auth-utils";
