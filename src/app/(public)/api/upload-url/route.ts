import { createClientSignedUploadUrl } from "@/lib/account-deletion";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ServiceTypeSchema } from "@/lib/server-validation";
import { getClientUser } from "@/lib/client-auth";
import {
  ORDER_FILES_BUCKET,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  buildPendingPath,
  getAllowedMimeTypes,
  getAllowedMultiReferenceMimeTypes,
  getFileExtension,
  isCanonicalDirectPendingToken,
  isCanonicalUploadExtension,
  normalizeSupabaseUserId,
  pendingTokenForSubmissionId,
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
 * them end up under `pending/<user-id>/<token>/...` and can be cleaned
 * up together on failure.
 */

const RequestSchema = z.object({
  submissionId: z.string().uuid(),
  serviceType: ServiceTypeSchema,
  pendingToken: z
    .string()
    .refine(isCanonicalDirectPendingToken, "Invalid pendingToken format"),
  itemIndex: z.number().int().min(0).max(99),
  kind: z.enum(["original", "reference"] as const),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  size: z
    .number()
    .int()
    .min(1, "File appears to be empty")
    .max(MAX_FILE_SIZE_BYTES, `File exceeds ${MAX_FILE_SIZE_MB} MB limit`),
  referenceId: z.string().uuid().optional(),
  referencePosition: z.number().int().min(0).max(9).optional(),
}).superRefine((data, ctx) => {
  const hasMultiReference =
    data.referenceId !== undefined || data.referencePosition !== undefined;
  if (
    hasMultiReference &&
    (data.kind !== "reference" ||
      data.referenceId === undefined ||
      data.referencePosition === undefined)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Multi-reference uploads require a reference ID and position.",
    });
  }
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
  // Authenticated-only (PR 2). No signed upload URL is issued without a
  // verified Supabase session. Identity is never trusted from the body.
  const sessionUser = await getClientUser();
  if (!sessionUser) {
    return NextResponse.json(
      { error: "You must be signed in to upload files." },
      { status: 401 }
    );
  }
  const ownerUserId = normalizeSupabaseUserId(sessionUser.id);
  if (!ownerUserId) {
    console.error("[upload-url] malformed authenticated session user id");
    return NextResponse.json(
      { error: "Could not prepare upload. Please try again." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object" || !("submissionId" in body)) {
    return NextResponse.json(
      {
        error: "This order form is outdated. Refresh before uploading.",
        code: "client_upgrade_required",
      },
      { status: 409 },
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

  const { submissionId, serviceType, pendingToken, itemIndex, kind, filename, contentType, size,
    referenceId, referencePosition } =
    parsed.data;

  if (pendingTokenForSubmissionId(submissionId) !== pendingToken) {
    return NextResponse.json(
      { error: "Upload namespace does not match submissionId." },
      { status: 400 },
    );
  }

  // MIME type allow-list. We trust the client's reported MIME enough to
  // route into the right bucket, but if it's not on the allow-list we
  // refuse to issue an upload URL at all. Note: Storage itself does
  // NOT validate content type when using a signed upload URL.
  const allowedTypes = referenceId
    ? getAllowedMultiReferenceMimeTypes()
    : getAllowedMimeTypes(serviceType, kind as UploadKind);
  if (!allowedTypes.includes(contentType)) {
    return NextResponse.json(
      {
        error: `File type "${contentType}" is not allowed for ${kind} uploads on ${serviceType}.`,
      },
      { status: 400 }
    );
  }

  const ext = getFileExtension(filename);
  if (!isCanonicalUploadExtension(ext)) {
    return NextResponse.json(
      { error: "Filename extension is not allowed." },
      { status: 400 }
    );
  }
  const path = buildPendingPath(
    ownerUserId,
    pendingToken,
    itemIndex,
    kind,
    ext,
    referencePosition,
    referenceId,
  );

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    console.error("Supabase admin init failed:", {
      reason: getSafeErrorLabel(err),
    });
    return NextResponse.json(
      { error: "Server configuration error. Please try again later." },
      { status: 500 }
    );
  }

  const { data, error } = await createClientSignedUploadUrl(
    supabase, ownerUserId, ORDER_FILES_BUCKET, path, { upsert: true },
  ).catch(() => ({ data: null, error: new Error("Account or upload unavailable") }));

  if (error || !data) {
    console.error("createSignedUploadUrl failed:", {
      reason: getSafeErrorLabel(error),
    });
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

function getSafeErrorLabel(error: unknown): string {
  if (error instanceof Error && error.name) return error.name;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.name === "string" && record.name.trim()) {
      return record.name.trim();
    }
    if (typeof record.statusCode === "string" && record.statusCode.trim()) {
      return `status:${record.statusCode.trim()}`;
    }
    if (typeof record.statusCode === "number") {
      return `status:${record.statusCode}`;
    }
  }
  return "StorageError";
}
