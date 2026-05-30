import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
// ============================================================

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;

  const code  = searchParams.get("code");
  const type  = searchParams.get("type");   // "recovery" | "signup" | null
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

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

  // Email confirmation, magic link, or generic → /dashboard
  return NextResponse.redirect(new URL("/dashboard", origin));
}
