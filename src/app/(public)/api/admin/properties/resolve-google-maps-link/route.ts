import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveGoogleMapsLink } from "@/features/property-showcase/map-location";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RequestSchema = z.object({
  link: z.string().trim().min(1).max(2048),
});

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paste a Google Maps link up to 2,048 characters." },
      { status: 400 },
    );
  }

  const result = await resolveGoogleMapsLink(parsed.data.link);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json(
    {
      coordinates: result.value.coordinates,
      resolvedUrl: result.value.resolvedUrl,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
