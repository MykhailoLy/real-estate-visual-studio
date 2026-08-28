import { type NextRequest, NextResponse } from "next/server";
import {
  DASHBOARD_REQUEST_PATH_HEADER,
  safeDashboardRequestPath,
} from "@/lib/dashboard-request-path";
import { createProxySupabaseClient } from "@/lib/supabase/proxy-client";

// ============================================================
// Next.js Proxy (middleware replacement in Next.js 16+)
//
// Refreshes /dashboard session cookies using @supabase/ssr. Dashboard
// authorization happens once in the server layout via getClientUser().
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

  if (!isDashboard) {
    return NextResponse.next();
  }

  const dashboardDestination = safeDashboardRequestPath(
    `${pathname}${req.nextUrl.search}`,
  );
  const { supabase, getResponse } = createProxySupabaseClient(req, {
    // Always overwrite or remove a browser-supplied copy. This is redirect
    // metadata only and is never used as identity.
    [DASHBOARD_REQUEST_PATH_HEADER]: dashboardDestination,
  });

  // Dashboard proxy work is refresh-only. getSession may rotate an expiring
  // token, but its unverified user/session data is deliberately ignored.
  if (supabase) {
    try {
      await supabase.auth.getSession();
    } catch {
      // The server layout's getUser() check remains the fail-closed gate.
    }
  }
  return getResponse();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
