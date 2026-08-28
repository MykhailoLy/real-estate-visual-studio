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

type RequestHeaderOverrides = Readonly<Record<string, string | null>>;

function getForwardedRequestHeaders(
  req: NextRequest,
  overrides: RequestHeaderOverrides,
): Headers {
  const headers = new Headers(req.headers);
  for (const [name, value] of Object.entries(overrides)) {
    headers.delete(name);
    if (value !== null) headers.set(name, value);
  }
  return headers;
}

export function createProxySupabaseClient(
  req: NextRequest,
  requestHeaderOverrides: RequestHeaderOverrides = {},
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let response = NextResponse.next({
    request: { headers: getForwardedRequestHeaders(req, requestHeaderOverrides) },
  });

  if (!url || !anonKey) {
    return { supabase: null, getResponse: () => response };
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Recreate the forwarded response after mutating the request cookie,
        // matching @supabase/ssr's required refresh propagation pattern.
        cookiesToSet.forEach(({ name, value }) =>
          req.cookies.set(name, value)
        );
        response = NextResponse.next({
          request: {
            headers: getForwardedRequestHeaders(req, requestHeaderOverrides),
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  return { supabase, getResponse: () => response };
}
