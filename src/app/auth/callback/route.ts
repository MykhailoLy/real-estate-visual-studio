import { after, type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isProfileComplete } from "@/lib/profile-completion";
import { safeInternalPath } from "@/lib/safe-redirect";
import { sendClientRegistrationAdminNotification } from "@/lib/email/client-registration-admin-notification";

export const runtime = "nodejs";

// ============================================================
// /auth/callback — Supabase Auth redirect handler
//
// Supabase redirects here after:
//   - Email confirmation  (type=signup  / code=…)
//   - Password reset link (type=recovery / code=…)
//   - Magic link          (code=…)
//   - Accepted admin invite (type=invite / verified session cookie)
//
// We exchange the PKCE `code` for a session server-side using
// the @supabase/ssr server client. This writes the session
// cookies before redirecting, so the proxy immediately sees the
// valid session on the next request — no client-side exchange
// needed, no redirect loop.
//
// After email confirmation (type=signup):
//   - If the user has no complete client_profiles row yet → onboarding
//   - If they already have a complete profile (e.g. re-confirming) → /dashboard
// ============================================================

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;

  const code  = searchParams.get("code");
  const type  = searchParams.get("type");   // "recovery" | "signup" | "invite" | null
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
  if (!code && type !== "invite") {
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
  // /auth/invite consumes the standard invite fragment in the browser. An
  // invite query parameter alone is never authentication: verify its cookies
  // with Auth before reading the profile or sending it to the dashboard.
  const { data: exchangeData, error: exchangeError } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : { data: null, error: null };

  if (exchangeError) {
    const target = new URL("/login", origin);
    target.searchParams.set("error", exchangeError.message);
    return NextResponse.redirect(target);
  }

  if (type === "invite") {
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user || data.user.is_anonymous) {
        return NextResponse.redirect(new URL("/login", origin));
      }
    } catch {
      return NextResponse.redirect(new URL("/login", origin));
    }
  }

  // ── Route based on flow type ──────────────────────────────

  // Password recovery → /reset-password so the user can set a new password
  if (type === "recovery") {
    return NextResponse.redirect(new URL("/reset-password", origin));
  }

  // The public signup marker only routes notifications; it is not identity or
  // authentication. Unmarked PKCE callbacks include existing-user magic links.
  const accessToken = exchangeData?.session?.access_token;
  if (searchParams.get("flow") === "signup" && (!type || type === "signup") && accessToken) {
    try {
      const { data, error: userError } = await supabase.auth.getUser(accessToken);
      // Supabase PKCE issues a new session with the stored Auth flow's AMR:
      // email/signup is distinct from magiclink, recovery, invite, email_change.
      // Verify this exchange's exact token, not an older cookie session. Account
      // timestamps cannot establish which event produced the current session.
      // https://supabase.com/docs/guides/auth/jwt-fields#authentication-methods-amrmethod
      const { data: verified, error: claimsError } = await supabase.auth.getClaims(accessToken);
      const methods = verified?.claims.amr;
      const user = data.user;
      if (!userError && user?.id && user.email && user.email_confirmed_at &&
          !user.is_anonymous && !user.invited_at && !claimsError &&
          verified?.claims.sub === user.id && Array.isArray(methods) &&
          methods.some((entry) => (typeof entry === "string" ? entry : entry?.method) === "email/signup")) {
        const registration = {
          userId: user.id,
          name: typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "",
          email: user.email,
          registeredAt: user.created_at,
        };
        after(async () => {
          await sendClientRegistrationAdminNotification(registration);
        });
      }
    } catch {
      // Best effort only: verification/scheduling failure must not alter Auth
      // cookies, onboarding, or redirects. Never log private Auth details.
    }
  }

  // Email confirmation (type=signup or default after signUp) →
  // check whether the profile is complete enough to place an order. Existing
  // incomplete historical rows must return to onboarding just like missing rows.
  if (type === "signup" || type === "invite" || !type) {
    try {
      const { data: profile } = await supabase
        .from("client_profiles")
        .select("first_name, last_name, full_name, phone")
        .maybeSingle();

      if (!isProfileComplete(profile)) {
        const onboarding = new URL("/dashboard/profile", origin);
        onboarding.searchParams.set("onboarding", "1");
        if (hasNext) onboarding.searchParams.set("next", nextPath);
        return NextResponse.redirect(onboarding);
      }
    } catch {
      if (type === "invite") {
        const onboarding = new URL("/dashboard/profile", origin);
        onboarding.searchParams.set("onboarding", "1");
        if (hasNext) onboarding.searchParams.set("next", nextPath);
        return NextResponse.redirect(onboarding);
      }
      // DB unavailable (e.g. env missing in build) — fall through.
    }
  }

  // Complete profile or unrecognised flow → intended destination (or dashboard).
  return NextResponse.redirect(new URL(nextPath, origin));
}
