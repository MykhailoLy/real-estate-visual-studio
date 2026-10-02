// ============================================================
// CLIENT AUTH — server-side session helpers
//
// Uses the @supabase/ssr server client (next/headers cookies) to
// validate the session and read the current user.
//
// Server-only. Never import this from a "use client" file.
// Import getInitials from client-auth-utils instead.
// ============================================================

import { assertClientAccountActive } from "@/lib/account-deletion";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

import { createServerSupabaseClient } from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────

export interface ClientUser {
  id: string;
  email: string;
  /** Display name: user_metadata.full_name, or email prefix as fallback */
  displayName: string;
  /** First word of displayName */
  firstName: string;
  /** Valid public avatar URL from trusted auth metadata, when available. */
  avatarUrl: string | null;
}

// ── Session helpers ───────────────────────────────────────────

/**
 * Server-side only. Returns a ClientUser if a valid session exists,
 * or null if unauthenticated. Uses supabase.auth.getUser() — a real
 * network call that validates the JWT with Supabase's auth server.
 */
export async function getClientUser(): Promise<ClientUser | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return null;
    await assertClientAccountActive(getSupabaseAdminClient(), user.id);

    const email = user.email ?? "";
    const meta  = (user.user_metadata ?? {}) as Record<string, unknown>;

    const rawName =
      typeof meta.full_name === "string" && meta.full_name.trim()
        ? meta.full_name.trim()
        : email.split("@")[0];
    const avatarCandidate =
      typeof meta.avatar_url === "string"
        ? meta.avatar_url
        : typeof meta.picture === "string"
          ? meta.picture
          : null;
    let avatarUrl: string | null = null;
    if (avatarCandidate) {
      try {
        const parsed = new URL(avatarCandidate);
        if (parsed.protocol === "https:" || parsed.protocol === "http:") {
          avatarUrl = parsed.toString();
        }
      } catch {
        avatarUrl = null;
      }
    }

    return {
      id:          user.id,
      email,
      displayName: rawName,
      firstName:   rawName.split(" ")[0],
      avatarUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Convenience wrapper — returns true when a valid session exists.
 */
export async function isClientAuthenticated(): Promise<boolean> {
  return (await getClientUser()) !== null;
}

// Re-export pure util so server callers can get everything from one import
export { getInitials } from "./client-auth-utils";
