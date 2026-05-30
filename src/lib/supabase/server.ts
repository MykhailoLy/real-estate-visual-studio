// ============================================================
// Supabase SSR — server client (Server Components / Route Handlers)
//
// Uses @supabase/ssr createServerClient with next/headers cookies.
// Reads AND writes cookies so refresh tokens are rotated correctly.
//
// Server-only. Never import this from a "use client" file.
// ============================================================

import { createServerClient as _createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  const cookieStore = await cookies();

  return _createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll is called from a Server Component where cookies
          // cannot be mutated — safe to ignore; the proxy refreshes
          // the session on the next request anyway.
        }
      },
    },
  });
}
