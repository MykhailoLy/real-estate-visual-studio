import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, adminCookieOptions } from "@/lib/admin-auth";

// ============================================================
// POST /api/admin/logout
//
// Always 200, idempotent. Overwrites the cookie with an
// immediately-expired empty value so even if the browser ignores
// `delete()` (it usually doesn't, but caches/CDNs can be quirky)
// the session value can no longer pass HMAC verification.
// ============================================================

export const runtime = "nodejs";

export async function POST() {
  const store = await cookies();
  store.set(ADMIN_COOKIE_NAME, "", adminCookieOptions(0));
  return NextResponse.json({ ok: true });
}
