// ============================================================
// Supabase SSR — proxy client
//
// For use inside src/proxy.ts (Next.js proxy/middleware).
// The proxy runtime cannot use next/headers or async cookies(),
// so we pass the NextRequest/NextResponse directly and let
// @supabase/ssr read/write cookies on the request/response pair.
//
// Never import next/headers here — proxy runs before the App
// Router and that module is not available in the edge/proxy runtime.
// ============================================================

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export function createProxySupabaseClient(
  req: NextRequest,
  res: NextResponse
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Env vars absent in build/sandbox — return a no-op sentinel
    // The proxy will treat this as unauthenticated.
    return null;
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Write refreshed tokens onto both the request (so the
        // SSR client inside the route sees them) and the response
        // (so the browser stores the updated cookie).
        cookiesToSet.forEach(({ name, value }) =>
          req.cookies.set(name, value)
        );
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        );
      },
    },
  });
}
