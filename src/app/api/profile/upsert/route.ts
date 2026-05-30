import { type NextRequest, NextResponse } from "next/server";
import { upsertClientProfile } from "@/lib/client-profile";
import type { UpsertProfileData } from "@/lib/client-profile";

export const runtime = "nodejs";

// ============================================================
// POST /api/profile/upsert
//
// Receives profile field values from ClientProfileForm and
// persists them via upsertClientProfile() (server-side).
// The user_id is read from the session cookie server-side —
// it is never accepted from the request body.
// ============================================================

export async function POST(req: NextRequest) {
  let body: Partial<UpsertProfileData>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Whitelist the fields we accept — ignore anything else
  const data: UpsertProfileData = {
    first_name:   typeof body.first_name   === "string" ? body.first_name   : undefined,
    last_name:    typeof body.last_name    === "string" ? body.last_name    : undefined,
    full_name:    typeof body.full_name    === "string" ? body.full_name    : undefined,
    company_name: typeof body.company_name === "string" ? body.company_name : undefined,
    phone:        typeof body.phone        === "string" ? body.phone        : undefined,
    country:      typeof body.country      === "string" ? body.country      : undefined,
    industry:     typeof body.industry     === "string" ? body.industry     : undefined,
    how_found_us: typeof body.how_found_us === "string" ? body.how_found_us : undefined,
  };

  const saved = await upsertClientProfile(data);

  if (!saved) {
    return NextResponse.json(
      { error: "Failed to save profile. Please ensure you are signed in and try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ profile: saved }, { status: 200 });
}
