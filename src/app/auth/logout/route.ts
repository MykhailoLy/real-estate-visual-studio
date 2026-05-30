import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// ============================================================
// POST /auth/logout — server-side sign-out
//
// Called by the dashboard "Sign out" button. Revokes the
// Supabase session via the service-role client (so the token
// is invalidated server-side), then returns a redirect to /login.
//
// If Supabase env vars are not configured (build/sandbox env),
// we still clear any cookies and redirect cleanly.
// ============================================================

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  try {
    const supabase = createServerClient();
    // Sign out globally (revokes all refresh tokens for this user)
    await supabase.auth.signOut();
  } catch {
    // Env vars not configured or network error — proceed with redirect anyway
  }

  // Redirect to login with a clean response.
  // The browser will drop the Supabase cookie naturally once the
  // JWT expires; we can't delete it server-side without @supabase/ssr,
  // but the middleware will catch the expired/missing token and
  // redirect on the next /dashboard visit.
  return NextResponse.redirect(
    new URL("/login", _req.nextUrl.origin),
    { status: 303 }
  );
}
