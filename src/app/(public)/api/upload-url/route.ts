import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ServiceTypeSchema } from "@/lib/server-validation";
import {
  ORDER_FILES_BUCKET,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  buildPendingPath,
  getAllowedMimeTypes,
  getFileExtension,
  type UploadKind,
} from "@/lib/upload-config";

// Tiny JSON-only endpoint. Vercel Function payload limits are not a
// concern here because no file bytes flow through this route — the
// browser uploads directly to Supabase Storage using the signed URL we
// hand back.
export const maxDuration = 30;

/**
 * Token namespace for the in-progress upload group. The client passes
 * the same `pendingToken` for every file in a single order, so all of
 * them end up under `pending/<token>/...` and can be cleaned up
 * together on failure. Keep characters URL-safe and short enough to
 * round-trip cleanly.
 */
const PENDING_TOKEN_REGEX = /^[A-Za-z0-9_-]{8,64}$/;

const RequestSchema = z.object({
  serviceType: ServiceTypeSchema,
  pendingToken: z
    .string()
    .regex(PENDING_TOKEN_REGEX, "Invalid pendingToken format"),
  itemIndex: z.number().int().min(0).max(99),
  kind: z.enum(["original", "reference"] as const),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  size: z
    .number()
    .int()
    .min(1, "File appears to be empty")
    .max(MAX_FILE_SIZE_BYTES, `File exceeds ${MAX_FILE_SIZE_MB} MB limit`),
});

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }
  return createClient(url, key);
}

/**
 * POST /api/upload-url
 *
 * Body (JSON):
 *   { serviceType, pendingToken, itemIndex, kind, filename, contentType, size }
 *
 * Response (JSON, 200):
 *   { bucket, path, token, signedUrl, originalFilename, size, mimeType }
 *
 * The client then uploads directly to Supabase Storage using
 * `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)`,
 * keeping the service-role key on the server.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { serviceType, pendingToken, itemIndex, kind, filename, contentType, size } =
    parsed.data;

  // MIME type allow-list. We trust the client's reported MIME enough to
  // route into the right bucket, but if it's not on the allow-list we
  // refuse to issue an upload URL at all. Note: Storage itself does
  // NOT validate content type when using a signed upload URL.
  const allowedTypes = getAllowedMimeTypes(serviceType, kind as UploadKind);
  if (!allowedTypes.includes(contentType)) {
    return NextResponse.json(
      {
        error: `File type "${contentType}" is not allowed for ${kind} uploads on ${serviceType}.`,
      },
      { status: 400 }
    );
  }

  const ext = getFileExtension(filename);
  const path = buildPendingPath(pendingToken, itemIndex, kind, ext);

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    console.error("Supabase admin init failed:", err);
    return NextResponse.json(
      { error: "Server configuration error. Please try again later." },
      { status: 500 }
    );
  }

  const { data, error } = await supabase.storage
    .from(ORDER_FILES_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("createSignedUploadUrl failed:", error);
    return NextResponse.json(
      { error: "Could not prepare upload. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    bucket: ORDER_FILES_BUCKET,
    path: data.path ?? path,
    token: data.token,
    signedUrl: data.signedUrl,
    // Echoed back so the client doesn't have to re-track these fields:
    originalFilename: filename,
    size,
    mimeType: contentType,
  });
}
