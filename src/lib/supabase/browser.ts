"use client";

// ============================================================
// Supabase SSR — browser client
//
// Uses @supabase/ssr createBrowserClient which automatically
// stores the session in cookies (not localStorage) so the proxy
// and server components can read it on every request.
//
// Singleton — safe to call from any "use client" component.
// ============================================================

import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function createBrowserSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  _client = _createBrowserClient(url, anonKey);
  return _client;
}
