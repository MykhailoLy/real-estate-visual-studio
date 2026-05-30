import { type NextRequest, NextResponse } from "next/server";

// ============================================================
// /auth/callback — Supabase Auth redirect handler
//
// Supabase Auth redirects here after:
//   - Email confirmation (sign-up)
//   - Password reset (forgot-password)
//   - Magic link (if used in the future)
//
// In @supabase/supabase-js v2 without @supabase/ssr, the PKCE
// flow exchange (code → session) happens client-side via the
// Supabase JS SDK on the page that receives the #fragment.
//
// This server route handles the simpler redirect flows where
// Supabase appends query params (?code=…&type=…) instead of
// hash fragments. We forward the browser to the right page so
// the client-side SDK can pick up the session.
//
// If the URL contains a `code` param, Supabase handles the
// exchange automatically when the JS SDK initialises on the
// target page. We just need to forward cleanly.
// ============================================================

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;

  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // If Supabase returned an error, forward to login with a message
  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set(
      "error",
      errorDescription ?? error ?? "Authentication failed"
    );
    return NextResponse.redirect(loginUrl);
  }

  // Password reset — forward to dashboard which will detect the
  // recovery session and can be extended to a /reset-password page later
  if (type === "recovery" || (code && type === "recovery")) {
    const target = new URL("/dashboard", origin);
    return NextResponse.redirect(target);
  }

  // Email confirmation / magic link — forward to dashboard
  // The client-side Supabase SDK will pick up the code from the URL
  // and exchange it for a session automatically on the dashboard page.
  if (code) {
    const target = new URL("/dashboard", origin);
    // Forward the code so the client SDK can complete the exchange
    target.searchParams.set("code", code);
    return NextResponse.redirect(target);
  }

  // Fallback — just go to login
  return NextResponse.redirect(new URL("/login", origin));
}
