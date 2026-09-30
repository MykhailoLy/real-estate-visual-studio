import { type NextRequest, NextResponse } from "next/server";
import {
  getClientProfile,
  upsertClientProfile,
} from "@/lib/client-profile";
import type { UpsertProfileData } from "@/lib/client-profile";
import {
  getMissingProfileCompletionFields,
  type ProfileCompletionFields,
} from "@/lib/profile-completion";

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

  // Partial API callers may omit fields, so validate the effective profile
  // rather than only the request body. This keeps profile editing compatible
  // while making the server the authoritative completeness gate.
  const currentProfile = await getClientProfile();
  const candidate: ProfileCompletionFields = {
    first_name:
      data.first_name === undefined
        ? currentProfile?.first_name ?? null
        : data.first_name,
    last_name:
      data.last_name === undefined
        ? currentProfile?.last_name ?? null
        : data.last_name,
    full_name:
      data.full_name === undefined
        ? currentProfile?.full_name ?? null
        : data.full_name,
    phone:
      data.phone === undefined
        ? currentProfile?.phone ?? null
        : data.phone,
    company_name:
      data.company_name === undefined
        ? currentProfile?.company_name ?? null
        : data.company_name,
  };

  const missingFields = getMissingProfileCompletionFields(candidate);
  if (missingFields.length > 0) {
    return NextResponse.json(
      {
        error: "Please add your name to your profile before continuing. Phone and company are optional.",
        code: "profile-incomplete",
        fields: missingFields,
      },
      { status: 422 },
    );
  }

  const saved = await upsertClientProfile(data);

  if (!saved) {
    return NextResponse.json(
      { error: "Failed to save profile. Please ensure you are signed in and try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ profile: saved }, { status: 200 });
}
