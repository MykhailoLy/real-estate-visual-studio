import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { checkAdminLoginRateLimit } from "@/lib/admin-login-rate-limit";
import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  buildSessionCookieValue,
  isAdminConfigured,
  verifyAdminPassword,
} from "@/lib/admin-auth";

// ============================================================
// POST /api/admin/login
//
// Body (JSON): { password: string }
// Response:
//   200 { ok: true }   — session cookie set
//   400 { error }      — body malformed
//   401 { error }      — wrong password
//   429 { error }      — temporarily unavailable; Retry-After supplied
//   503 { error }      — authentication/security backend unavailable
//
// Deliberately uses Node runtime (default for app router) so
// crypto.timingSafeEqual is available in admin-auth.
// ============================================================

export const runtime = "nodejs";

const Body = z.object({
  password: z.string().min(1, "Password is required").max(512),
});

const unavailable = { error: "Unable to sign in. Please try again later." };

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      unavailable,
      { status: 503 }
    );
  }

  // Charge every attempt before parsing or checking credentials. Never reset on
  // success: malformed requests and valid passwords cannot clear the budget.
  try {
    const decision = await checkAdminLoginRateLimit(request);
    if (!decision.allowed) {
      return NextResponse.json(unavailable, {
        status: 429,
        headers: { "Retry-After": String(decision.retryAfterSeconds) },
      });
    }
  } catch {
    return NextResponse.json(unavailable, { status: 503 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = Body.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password is required." },
      { status: 400 }
    );
  }

  if (!verifyAdminPassword(parsed.data.password)) {
    // Generic error to avoid leaking which input field is wrong.
    return NextResponse.json(
      { error: "Incorrect password." },
      { status: 401 }
    );
  }

  const { value, maxAge } = buildSessionCookieValue();
  const store = await cookies();
  store.set(ADMIN_COOKIE_NAME, value, adminCookieOptions(maxAge));

  return NextResponse.json({ ok: true });
}
