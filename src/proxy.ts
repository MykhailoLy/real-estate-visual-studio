import { type NextRequest, NextResponse } from "next/server";
import { hasVerifiedAuthenticatedSubject } from "@/lib/supabase/auth-claims";
import { createProxySupabaseClient } from "@/lib/supabase/proxy-client";

// ============================================================
// Next.js Proxy (middleware replacement in Next.js 16+)
//
// Protects /dashboard and all sub-routes using @supabase/ssr.
// supabase.auth.getClaims() verifies the access-token signature and
// subject — no manual JWT decoding and no browser-controlled identity.
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
      const { data, error } = await supabase.auth.getClaims();
      authenticated =
        !error && hasVerifiedAuthenticatedSubject(data?.claims);
    } catch {
      // Verification error or invalid session — treat as unauthenticated
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
