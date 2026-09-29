// ============================================================
// PROFILE COMPLETION — server-side contract
//
// An authenticated client can only place an order once their
// client_profiles row has the minimum fields an order needs:
//   - a non-empty name (full_name, or first_name + last_name)
// Phone, company, and all other profile fields are optional.
// Email + verified session come from Supabase
// Auth, never from the profile row.
//
// This module is the single server source of truth for onboarding,
// profile saves, and order identity resolution.
// ============================================================

import "server-only";

export interface ProfileCompletionFields {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  company_name?: string | null;
}

export type MissingProfileField = "name";

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
export function resolveProfileName(
  profile: ProfileCompletionFields | null,
): string {
  if (!profile) return "";
  const full = (profile.full_name ?? "").trim();
  if (full) return full;
  return [profile.first_name ?? "", profile.last_name ?? ""]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Return the exact order-blocking fields still missing from a profile. */
export function getMissingProfileCompletionFields(
  profile: ProfileCompletionFields | null,
): MissingProfileField[] {
  if (!profile) return ["name"];

  const missing: MissingProfileField[] = [];
  if (!resolveProfileName(profile)) missing.push("name");
  return missing;
}

/**
 * True when the profile has the minimum fields required to order:
 * a non-empty resolved name. Phone and company are optional.
 */
export function isProfileComplete(
  profile: ProfileCompletionFields | null,
): boolean {
  return getMissingProfileCompletionFields(profile).length === 0;
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
  profile: ProfileCompletionFields | null,
): ResolvedClientIdentity | null {
  if (!email || !profile || !isProfileComplete(profile)) return null;

  return {
    name: resolveProfileName(profile),
    email,
    // Production orders.client_phone is NOT NULL; preserve its snapshot shape.
    phone: (profile.phone ?? "").trim(),
    company: (profile.company_name ?? "").trim() || null,
  };
}
