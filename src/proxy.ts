import { type NextRequest, NextResponse } from "next/server";
import { createProxySupabaseClient } from "@/lib/supabase/proxy-client";

// ============================================================
// Next.js Proxy (middleware replacement in Next.js 16+)
//
// Protects /dashboard and all sub-routes using @supabase/ssr.
// supabase.auth.getUser() validates the session against Supabase
// — no manual JWT decoding, no localStorage, no infinite loops.
//
// The SSR client reads the session from the HTTP cookie that
// createBrowserClient writes after login, and rotates refresh
// tokens by writing updated cookies onto the response.
//
// Admin routes (/admin/*) are completely untouched.
// ============================================================

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Pass through non-protected routes immediately (avoid
  // creating a Supabase client on every static asset request).
  const isDashboard = pathname.startsWith("/dashboard");
  const isAuthPage  = pathname === "/login" || pathname === "/signup";

  if (!isDashboard && !isAuthPage) {
    return NextResponse.next();
  }

  // Build a mutable response that the SSR client can write
  // refreshed session cookies onto.
  const res = NextResponse.next({ request: req });

  // Create the SSR-aware Supabase client.
  // Returns null when env vars are absent (build time / sandbox).
  const supabase = createProxySupabaseClient(req, res);

  // ── Determine auth state ──────────────────────────────────
  let authenticated = false;
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      authenticated = user !== null;
    } catch {
      // Network error or invalid session — treat as unauthenticated
      authenticated = false;
    }
  }

  // ── /dashboard/* — require auth ───────────────────────────
  if (isDashboard && !authenticated) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── /login + /signup — redirect authenticated users away ──
  if (isAuthPage && authenticated) {
    const dashboardUrl = req.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  // Pass through with any updated session cookies on the response
  return res;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/signup",
  ],
};
