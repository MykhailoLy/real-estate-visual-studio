// ============================================================
// CLIENT PROFILE — server-side helpers
//
// Reads and writes rows in the `client_profiles` table.
// Always uses the @supabase/ssr server client so RLS is
// enforced via the authenticated user's session cookie.
//
// Server-only. Never import from a "use client" file.
//
// NOTE: The client_profiles table is created by the migration in
// supabase/add-client-profiles.sql (added in PR #33).
// Until that migration is run, getClientProfile() returns null
// gracefully — the dashboard degrades safely without crashing.
// ============================================================

import { createServerSupabaseClient } from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────

export interface ClientProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  country: string | null;
  industry: string | null;
  how_found_us: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertProfileData {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  country?: string | null;
  industry?: string | null;
  how_found_us?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Returns the client_profiles row for the currently authenticated user,
 * or null if no row exists yet (new user who hasn't completed onboarding)
 * or if the table doesn't exist yet (pre-migration).
 */
export async function getClientProfile(): Promise<ClientProfile | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("client_profiles")
      .select("*")
      .maybeSingle();

    if (error) return null;
    return data as ClientProfile | null;
  } catch {
    return null;
  }
}

/**
 * Upserts the client_profiles row for the currently authenticated user.
 * user_id is read from the session — never passed from the client.
 */
export async function upsertClientProfile(
  data: UpsertProfileData
): Promise<ClientProfile | null> {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return null;

    const payload = {
      user_id: user.id,
      ...data,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error: upsertError } = await supabase
      .from("client_profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();

    if (upsertError) return null;
    return saved as ClientProfile;
  } catch {
    return null;
  }
}
