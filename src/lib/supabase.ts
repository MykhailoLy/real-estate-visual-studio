import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Lazy Supabase clients
//
// We deliberately avoid creating a client at module load time. The
// browser client is imported by client-side code that is also pulled
// into static generation (e.g. order page bundles). When the build
// environment doesn't expose NEXT_PUBLIC_* env vars (sandbox builds,
// CI without secrets, etc.), eagerly calling `createClient` aborts
// the prerender with `supabaseUrl is required`.
//
// Instead we defer client construction until the first call. At that
// point we are guaranteed to be running in a browser (or a server
// route) where the relevant env vars exist.
// ============================================================

let browserClient: SupabaseClient | null = null;

/**
 * Get the shared client-side Supabase client. Uses the public anon
 * key and respects RLS. Safe to call from any "use client" context.
 *
 * Throws on first call if the public env vars are missing — which is
 * the correct behaviour at runtime, but never happens during build
 * because no build code path actually calls this.
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY env vars."
    );
  }
  browserClient = createClient(url, anonKey);
  return browserClient;
}

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
