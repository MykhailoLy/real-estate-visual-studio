import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyStoredPropertyCustomFlyer } from "@/features/property-showcase/custom-flyer-storage";
import { getPropertyShowcaseForAdminById } from "@/features/property-showcase/server";
import { ownedPropertyCustomFlyerStoragePath } from "@/features/property-showcase/storage-cleanup";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { deleteSiteMediaFiles } from "@/lib/site-media-server";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string }>;
}

const Body = z.object({
  format: z.enum(["pdf", "jpg", "png"]),
  path: z.string().trim().min(1).max(1024),
}).strict();

export async function POST(request: Request, context: Context) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid flyer verification request." }, { status: 400 });
  }

  const { id } = await context.params;
  const record = await getPropertyShowcaseForAdminById(id);
  if (!record) return NextResponse.json({ error: "Property not found." }, { status: 404 });

  const verified = await verifyStoredPropertyCustomFlyer({
    slug: record.slug,
    format: parsed.data.format,
    value: parsed.data.path,
  });
  if (!verified.ok) {
    // The signed upload is owned by this property folder, so a rejected upload
    // can be safely removed without accepting arbitrary deletion targets.
    await deleteSiteMediaFiles([
      ownedPropertyCustomFlyerStoragePath(parsed.data.path, record.slug, {
        allowRelativeObjectPath: true,
      }),
    ]);
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    path: verified.path,
    publicUrl: verified.publicUrl,
  });
}
