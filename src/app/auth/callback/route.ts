import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { safeInternalPath } from "@/lib/safe-redirect";

export const runtime = "nodejs";

// ============================================================
// /auth/callback — Supabase Auth redirect handler
//
// Supabase redirects here after:
//   - Email confirmation  (type=signup  / code=…)
//   - Password reset link (type=recovery / code=…)
//   - Magic link          (code=…)
//
// We exchange the PKCE `code` for a session server-side using
// the @supabase/ssr server client. This writes the session
// cookies before redirecting, so the proxy immediately sees the
// valid session on the next request — no client-side exchange
// needed, no redirect loop.
//
// After email confirmation (type=signup):
//   - If the user has no client_profiles row yet → /dashboard/profile?onboarding=1
//   - If they already have a profile (e.g. re-confirming) → /dashboard
// ============================================================

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;

  const code  = searchParams.get("code");
  const type  = searchParams.get("type");   // "recovery" | "signup" | null
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Intended post-auth destination (e.g. a selected order route),
  // sanitized to an internal path. Defaults to /dashboard.
  const nextPath = safeInternalPath(searchParams.get("next"));
  const hasNext = nextPath !== "/dashboard";

  // ── Error forwarded by Supabase ───────────────────────────
  if (error) {
    const target = new URL("/login", origin);
    target.searchParams.set("error", errorDescription ?? error);
    return NextResponse.redirect(target);
  }

  // ── No code — nothing to exchange ────────────────────────
  if (!code) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  // ── Build SSR server client with mutable cookie store ────
  const cookieStore = await cookies();

  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Env vars missing (build environment) — redirect to login
    return NextResponse.redirect(new URL("/login", origin));
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore — cookies are set on the response below anyway
        }
      },
    },
  });

  // ── Exchange the code for a session ──────────────────────
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const target = new URL("/login", origin);
    target.searchParams.set("error", exchangeError.message);
    return NextResponse.redirect(target);
  }

  // ── Route based on flow type ──────────────────────────────

  // Password recovery → /reset-password so the user can set a new password
  if (type === "recovery") {
    return NextResponse.redirect(new URL("/reset-password", origin));
  }

  // Email confirmation (type=signup or default after signUp) →
  // check if the user already has a profile row. If not, send them to
  // onboarding, preserving the intended destination so they return to
  // the selected order form after completing their profile.
  if (type === "signup" || !type) {
    try {
      const { data: profile } = await supabase
        .from("client_profiles")
        .select("id")
        .maybeSingle();

      if (!profile) {
        const onboarding = new URL("/dashboard/profile", origin);
        onboarding.searchParams.set("onboarding", "1");
        if (hasNext) onboarding.searchParams.set("next", nextPath);
        return NextResponse.redirect(onboarding);
      }
    } catch {
      // DB unavailable (e.g. env missing in build) — fall through.
    }
  }

  // Profile exists or unrecognised flow → intended destination (or dashboard).
  return NextResponse.redirect(new URL(nextPath, origin));
}
