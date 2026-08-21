import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { failedAdminUploadCleanupCandidates } from "@/lib/admin-upload-cleanup";
import {
  PORTFOLIO_SERVICE_SLUGS,
  type PortfolioServiceSlug,
} from "@/lib/portfolio";
import {
  ADMIN_ALLOWED_IMAGE_MIME_TYPES,
  ADMIN_MAX_IMAGE_BYTES,
  ADMIN_MAX_IMAGE_MB,
  buildPortfolioObjectPath,
  createPortfolioSignedUploadUrl,
  deletePortfolioFiles,
  isValidPortfolioObjectPath,
  unreferencedPortfolioFiles,
} from "@/lib/portfolio-server";

// ============================================================
// POST /api/admin/portfolio/upload-url
//
// Issue a short-lived signed Supabase Storage upload URL so the
// browser can PUT the image bytes directly to the `portfolio`
// bucket. NO file bytes flow through this route, which is the
// whole point — Vercel returns 413 FUNCTION_PAYLOAD_TOO_LARGE
// when a multi-MB multipart body lands on a Function, but a
// signed URL response is just a few hundred bytes of JSON.
//
// Request body (JSON):
//   service_slug : one of PORTFOLIO_SERVICE_SLUGS
//   filename     : original filename (used only to build path)
//   content_type : "image/jpeg" | "image/png" | "image/webp"
//   file_size    : bytes, must be <= 10 MB
//   kind         : "before" | "after"
//
// Response (200, JSON):
//   { bucket, path, token, signedUrl, contentType, kind }
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
  service_slug: z.enum(PORTFOLIO_SERVICE_SLUGS),
  filename: z.string().min(1).max(255),
  content_type: z.enum(ADMIN_ALLOWED_IMAGE_MIME_TYPES),
  file_size: z
    .number()
    .int("File size must be a whole number of bytes.")
    .min(1, "File appears to be empty.")
    .max(
      ADMIN_MAX_IMAGE_BYTES,
      `File is too large. Max ${ADMIN_MAX_IMAGE_MB} MB.`
    ),
  kind: z.enum(["before", "after"] as const),
});

const CleanupBody = z
  .object({
    service_slug: z.enum(PORTFOLIO_SERVICE_SLUGS),
    uploaded_paths: z.array(z.string().trim().min(1).max(512)).max(2),
    retained_paths: z
      .array(z.string().trim().min(1).max(512))
      .max(2)
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
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    // Surface the first useful message verbatim so the admin UI
    // can display it without translating Zod issue codes itself.
    const flat = parsed.error.flatten();
    const firstFieldError =
      Object.values(flat.fieldErrors)
        .flat()
        .find((m): m is string => typeof m === "string" && m.length > 0) ??
      "Invalid request.";

    // Disambiguate the two most common failure shapes so the
    // client can show its dedicated error copy.
    const hasSize = !!flat.fieldErrors.file_size?.length;
    const hasMime = !!flat.fieldErrors.content_type?.length;
    let message = firstFieldError;
    if (hasSize) {
      message = `File is too large. Max ${ADMIN_MAX_IMAGE_MB} MB.`;
    } else if (hasMime) {
      message = "Unsupported file type. Use JPG, PNG, or WebP.";
    }

    return NextResponse.json(
      { error: message, details: flat },
      { status: 400 }
    );
  }

  const {
    service_slug,
    filename,
    content_type,
    kind,
  } = parsed.data;

  const path = buildPortfolioObjectPath(
    service_slug as PortfolioServiceSlug,
    kind,
    filename
  );

  let signed;
  try {
    signed = await createPortfolioSignedUploadUrl(path);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not create signed upload URL.";
    console.error("portfolio: upload-url failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    bucket: signed.bucket,
    path: signed.path,
    token: signed.token,
    signedUrl: signed.signedUrl,
    contentType: content_type,
    kind,
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

  const serviceSlug = parsed.data.service_slug as PortfolioServiceSlug;
  const paths = failedAdminUploadCleanupCandidates({
    uploadedPaths: parsed.data.uploaded_paths,
    retainedPaths: parsed.data.retained_paths,
    isOwnedPath: (path) => isValidPortfolioObjectPath(path, serviceSlug),
  });

  const unreferencedPaths = await unreferencedPortfolioFiles(paths);
  await deletePortfolioFiles(unreferencedPaths);
  return NextResponse.json({ ok: true, deleted: unreferencedPaths.length });
}
