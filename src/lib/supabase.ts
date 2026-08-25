import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Lazy server-side Supabase client
//
// This module is reserved for the existing service-role server client.
// Browser auth and signed uploads share the cookie-aware singleton in
// src/lib/supabase/browser.ts.
// ============================================================

/**
 * Server-side Supabase client (uses service role key, bypasses RLS).
 * Only use this in API routes / server components.
 */
export function createServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars."
    );
  }
  return createClient(url, serviceRoleKey);
}
