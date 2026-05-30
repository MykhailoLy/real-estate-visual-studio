import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// ============================================================
// POST /auth/logout — server-side sign-out
//
// Uses the @supabase/ssr server client so the session cookies
// are cleared properly (the client calls setAll with expired
// cookie options). The browser will drop the session cookies
// on this response, and the proxy will redirect any subsequent
// /dashboard request to /login.
// ============================================================

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // Env vars absent or network error — proceed with redirect anyway
  }

  return NextResponse.redirect(
    new URL("/login", _req.nextUrl.origin),
    { status: 303 }
  );
}
