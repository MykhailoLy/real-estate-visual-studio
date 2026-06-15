// ============================================================
// PROFILE COMPLETION — server-side identity resolution
//
// An authenticated client can only place an order once their
// client_profiles row has the minimum fields an order needs:
//   - a non-empty name (full_name, or first_name + last_name)
//   - a non-empty phone
// Company is optional. Email + verified session come from Supabase
// Auth, never from the profile row.
//
// This module is the single source of truth for:
//   - whether a profile is "complete enough" to order
//   - how to resolve the snapshot identity written onto an order
//
// Server-only. The order form (client) must never import this; it
// learns about incompleteness from the API's 422 response instead.
// ============================================================

import "server-only";
import type { ClientProfile } from "@/lib/client-profile";

/** Snapshot identity written onto an order (and used for emails). */
export interface ResolvedClientIdentity {
  name: string;
  email: string;
  phone: string;
  company: string | null;
}

/**
 * Resolve a display name from a profile:
 *   1. full_name (trimmed), else
 *   2. trimmed first_name + last_name joined by a space.
 * Returns "" when nothing usable is present.
 */
export function resolveProfileName(profile: ClientProfile | null): string {
  if (!profile) return "";
  const full = (profile.full_name ?? "").trim();
  if (full) return full;
  return [profile.first_name ?? "", profile.last_name ?? ""]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

/**
 * True when the profile has the minimum fields required to order:
 * a non-empty resolved name AND a non-empty phone. Company is optional.
 */
export function isProfileComplete(profile: ClientProfile | null): boolean {
  if (!profile) return false;
  const name = resolveProfileName(profile);
  const phone = (profile.phone ?? "").trim();
  return name.length > 0 && phone.length > 0;
}

/**
 * Build the order snapshot identity from the VERIFIED session email
 * and the profile. Returns null when the profile is incomplete, so
 * callers can return a 422 / redirect to onboarding.
 *
 * `email` MUST come from the verified Supabase Auth user, never the
 * request body or the profile row.
 */
export function resolveClientIdentity(
  email: string,
  profile: ClientProfile | null,
): ResolvedClientIdentity | null {
  if (!email || !profile) return null;
  const name = resolveProfileName(profile);
  const phone = (profile.phone ?? "").trim();
  if (!name || !phone) return null;
  return {
    name,
    email,
    phone,
    company: (profile.company_name ?? "").trim() || null,
  };
}
