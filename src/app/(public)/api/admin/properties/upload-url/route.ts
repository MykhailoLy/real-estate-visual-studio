import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  createSiteMediaSignedUploadUrl,
  safeFilename,
  SITE_MEDIA_ALLOWED_MIMES,
} from "@/lib/site-media-server";

export const runtime = "nodejs";

const MAX_PROPERTY_MEDIA_BYTES = 25 * 1024 * 1024;
const MAX_PROPERTY_MEDIA_MB = MAX_PROPERTY_MEDIA_BYTES / (1024 * 1024);

const Body = z
  .object({
    slug: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    kind: z.enum(["gallery", "floor-plan", "tour-poster"]),
    filename: z.string().trim().min(1).max(255),
    content_type: z.enum(SITE_MEDIA_ALLOWED_MIMES),
    file_size: z.number().int().min(1).max(MAX_PROPERTY_MEDIA_BYTES),
  })
  .strict();

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

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    let message =
      Object.values(flat.fieldErrors)
        .flat()
        .find((item): item is string => Boolean(item)) ?? "Invalid request.";

    if ((flat.fieldErrors.file_size ?? []).length > 0) {
      message = `File is too large. Max ${MAX_PROPERTY_MEDIA_MB} MB.`;
    } else if ((flat.fieldErrors.content_type ?? []).length > 0) {
      message = "Unsupported file type. Use JPG, PNG, or WebP.";
    }

    return NextResponse.json({ error: message, details: flat }, { status: 400 });
  }

  const { slug, kind, filename, content_type } = parsed.data;
  const nonce = randomBytes(5).toString("hex");
  const path = `property-showcases/${slug}/${Date.now()}-${nonce}-${kind}-${safeFilename(filename)}`;

  try {
    const signed = await createSiteMediaSignedUploadUrl(path);
    return NextResponse.json({
      bucket: signed.bucket,
      path: signed.path,
      token: signed.token,
      signedUrl: signed.signedUrl,
      contentType: content_type,
      kind,
    });
  } catch (error) {
    console.error("property-showcase: upload URL failed", error);
    return NextResponse.json(
      { error: "Could not create property media upload URL." },
      { status: 500 },
    );
  }
}
