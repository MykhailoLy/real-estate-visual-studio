import { type NextRequest, NextResponse } from "next/server";

// ============================================================
// Next.js Middleware — client dashboard route protection
//
// Protects every /dashboard and /dashboard/* route.
// Uses the same lightweight JWT-in-cookie approach as
// src/lib/client-auth.ts — decode payload, check expiry, redirect
// if missing or expired.
//
// We cannot import server-only modules (next/headers) here; instead
// we read cookies directly from the NextRequest object.
//
// Admin routes (/admin/*) are left completely untouched —
// they use a separate HMAC cookie checked in their own layout.
// ============================================================

// ── JWT helpers (duplicated from client-auth.ts to avoid the
//    next/headers import that is forbidden in middleware) ──────

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    // In the middleware runtime atob is available
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function findSupabaseCookieValue(req: NextRequest): string | null {
  const cookies = req.cookies;
  for (const [name, cookie] of cookies) {
    if (
      name.startsWith("sb-") &&
      (name.endsWith("-auth-token") || name.endsWith("-auth-token.0"))
    ) {
      const raw = typeof cookie === "string" ? cookie : cookie.value;
      if (!raw) continue;

      // Try JSON envelope first
      try {
        const parsed = JSON.parse(raw) as { access_token?: string };
        if (parsed?.access_token) return parsed.access_token;
      } catch {
        // not JSON
      }

      if (raw.split(".").length === 3) return raw;
    }
  }
  return null;
}

function isValidSession(req: NextRequest): boolean {
  const token = findSupabaseCookieValue(req);
  if (!token) return false;

  const payload = decodeJwtPayload(token);
  if (!payload) return false;

  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  if (exp > 0 && Math.floor(Date.now() / 1000) >= exp) return false;

  // Must have a subject (user id) and email
  return typeof payload.sub === "string" && typeof payload.email === "string";
}

// ── Proxy (replaces middleware in Next.js 16+) ────────────────

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Protect /dashboard and all sub-routes ──
  if (pathname.startsWith("/dashboard")) {
    if (!isValidSession(req)) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      // Preserve the intended destination so we can redirect back after login
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Redirect authenticated users away from /login and /signup ──
  if (pathname === "/login" || pathname === "/signup") {
    if (isValidSession(req)) {
      const dashboardUrl = req.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      dashboardUrl.search = "";
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match /dashboard and all sub-paths
    "/dashboard/:path*",
    // Redirect authenticated users away from auth pages
    "/login",
    "/signup",
  ],
};
