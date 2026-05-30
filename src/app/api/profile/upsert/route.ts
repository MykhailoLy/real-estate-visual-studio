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
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Whitelist the fields we accept — ignore anything else.
  // Accept string (set) or null (clear); undefined means the key was
  // absent from the request body entirely — don't touch that column.
  function field(v: unknown): string | null | undefined {
    if (typeof v === "string") return v;
    if (v === null) return null;
    return undefined; // key absent or unexpected type — omit from upsert
  }

  const data: UpsertProfileData = {
    first_name:   field(body.first_name),
    last_name:    field(body.last_name),
    full_name:    field(body.full_name),
    company_name: field(body.company_name),
    phone:        field(body.phone),
    country:      field(body.country),
    industry:     field(body.industry),
    how_found_us: field(body.how_found_us),
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
