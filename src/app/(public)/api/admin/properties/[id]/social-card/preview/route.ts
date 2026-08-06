import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getPropertyShowcaseForAdminById } from "@/features/property-showcase/server";
import { PropertyShowcaseSchema } from "@/features/property-showcase/schema";
import {
  createPropertySocialPreviewResponse,
  PROPERTY_SOCIAL_PREVIEW_CACHE_CONTROL,
} from "@/features/property-showcase/social-preview-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string }>;
}

const errorHeaders = { "Cache-Control": PROPERTY_SOCIAL_PREVIEW_CACHE_CONTROL };

export async function POST(request: Request, context: Context) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: errorHeaders },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 256 * 1024) {
    return NextResponse.json(
      { error: "Preview request is too large." },
      { status: 413, headers: errorHeaders },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: errorHeaders },
    );
  }

  const draft = raw && typeof raw === "object"
    ? (raw as { property?: unknown }).property
    : undefined;
  const parsed = PropertyShowcaseSchema.safeParse(draft);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid social preview data." },
      { status: 400, headers: errorHeaders },
    );
  }

  const { id } = await context.params;
  const record = await getPropertyShowcaseForAdminById(id);
  if (!record) {
    return NextResponse.json(
      { error: "Property not found." },
      { status: 404, headers: errorHeaders },
    );
  }
  if (parsed.data.slug !== record.slug) {
    return NextResponse.json(
      { error: "Preview property does not match this record." },
      { status: 400, headers: errorHeaders },
    );
  }

  return createPropertySocialPreviewResponse(parsed.data);
}
