import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { failedAdminUploadCleanupCandidates } from "@/lib/admin-upload-cleanup";
import {
  SITE_MEDIA_SECTIONS,
  SITE_MEDIA_UPLOAD_KINDS,
  type SiteMediaSection,
  type SiteMediaUploadKind,
} from "@/lib/site-media";
import {
  buildSiteMediaObjectPath,
  createSiteMediaSignedUploadUrl,
  deleteSiteMediaFiles,
  isValidSiteMediaObjectPath,
  SITE_MEDIA_ALLOWED_MIMES,
  SITE_MEDIA_MAX_IMAGE_BYTES,
  SITE_MEDIA_MAX_IMAGE_MB,
  unreferencedSiteMediaFiles,
} from "@/lib/site-media-server";

// ============================================================
// POST /api/admin/media/upload-url
//
// Issue a short-lived signed Supabase Storage upload URL so the
// browser can PUT the image bytes directly to the `site-media`
// bucket. NO file bytes flow through this route — the same
// pattern the portfolio admin already uses to dodge Vercel's
// FUNCTION_PAYLOAD_TOO_LARGE (413) on multipart uploads.
//
// Request body (JSON):
//   section      : one of SITE_MEDIA_SECTIONS
//   kind         : "image" | "before" | "after" | "poster" | "panorama"
//   filename     : original filename (used only to build path)
//   content_type : "image/jpeg" | "image/png" | "image/webp"
//   file_size    : bytes, must be <= 10 MB
//
// Response (200, JSON):
//   { bucket, path, token, signedUrl, contentType, kind, section }
//
// 401 if no admin cookie. 400 on validation errors. 500 on
// Supabase errors.
//
// SECURITY: SUPABASE_SERVICE_ROLE_KEY is only ever used inside
// this route handler. The signed URL handed back to the client
// does not include the service role key.
// ============================================================

export const runtime = "nodejs";

const Body = z.object({
  section: z.enum(SITE_MEDIA_SECTIONS),
  kind: z.enum(SITE_MEDIA_UPLOAD_KINDS),
  filename: z.string().min(1).max(255),
  content_type: z.enum(SITE_MEDIA_ALLOWED_MIMES),
  file_size: z
    .number()
    .int("File size must be a whole number of bytes.")
    .min(1, "File appears to be empty.")
    .max(
      SITE_MEDIA_MAX_IMAGE_BYTES,
      `File is too large. Max ${SITE_MEDIA_MAX_IMAGE_MB} MB.`
    ),
});

const CleanupBody = z
  .object({
    section: z.enum(SITE_MEDIA_SECTIONS),
    uploaded_paths: z.array(z.string().trim().min(1).max(512)).max(5),
    retained_paths: z
      .array(z.string().trim().min(1).max(512))
      .max(5)
      .optional(),
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
    // Surface a useful, copy-pastable error so the admin UI can
    // show it verbatim. Disambiguate the two most common shapes
    // (size, mime) so the client doesn't have to translate Zod
    // codes back into human strings.
    const flat = parsed.error.flatten();
    const firstFieldError =
      Object.values(flat.fieldErrors)
        .flat()
        .find((m): m is string => typeof m === "string" && m.length > 0) ??
      "Invalid request.";

    let message = firstFieldError;
    if ((flat.fieldErrors.file_size ?? []).length > 0) {
      message = `File is too large. Max ${SITE_MEDIA_MAX_IMAGE_MB} MB.`;
    } else if ((flat.fieldErrors.content_type ?? []).length > 0) {
      message = "Unsupported file type. Use JPG, PNG, or WebP.";
    }

    return NextResponse.json(
      { error: message, details: flat },
      { status: 400 }
    );
  }

  const { section, kind, filename, content_type } = parsed.data;

  const path = buildSiteMediaObjectPath(
    section as SiteMediaSection,
    kind as SiteMediaUploadKind,
    filename
  );

  let signed;
  try {
    signed = await createSiteMediaSignedUploadUrl(path);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not create signed upload URL.";
    console.error("site-media: upload-url failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    bucket: signed.bucket,
    path: signed.path,
    token: signed.token,
    signedUrl: signed.signedUrl,
    contentType: content_type,
    kind,
    section,
  });
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = CleanupBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid cleanup request.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const section = parsed.data.section as SiteMediaSection;
  const paths = failedAdminUploadCleanupCandidates({
    uploadedPaths: parsed.data.uploaded_paths,
    retainedPaths: parsed.data.retained_paths,
    isOwnedPath: (path) => isValidSiteMediaObjectPath(path, section),
  });

  const unreferencedPaths = await unreferencedSiteMediaFiles(paths);
  await deleteSiteMediaFiles(unreferencedPaths);
  return NextResponse.json({ ok: true, deleted: unreferencedPaths.length });
}
