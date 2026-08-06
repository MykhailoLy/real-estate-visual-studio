import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/seo";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getPropertyShowcaseForAdminById } from "@/features/property-showcase/server";
import {
  PropertyMarketingPreviewDraftSchema,
  PropertyShowcaseSchema,
} from "@/features/property-showcase/schema";
import {
  createPropertyMarketingPreviewResponse,
  PROPERTY_MARKETING_PREVIEW_CACHE_CONTROL,
} from "@/features/property-showcase/marketing-material-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string }>;
}

const errorHeaders = { "Cache-Control": PROPERTY_MARKETING_PREVIEW_CACHE_CONTROL };

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
  const previewRaw = raw && typeof raw === "object"
    ? (() => {
        const preview = { ...(raw as Record<string, unknown>) };
        delete preview.property;
        return preview;
      })()
    : raw;
  const parsed = PropertyMarketingPreviewDraftSchema.safeParse(previewRaw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid preview configuration.",
      },
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

  const propertyRaw = raw && typeof raw === "object"
    ? (raw as { property?: unknown }).property
    : undefined;
  const propertyDraft = propertyRaw === undefined
    ? null
    : PropertyShowcaseSchema.safeParse(propertyRaw);
  if (propertyDraft && !propertyDraft.success) {
    return NextResponse.json(
      { error: propertyDraft.error.issues[0]?.message ?? "Invalid property preview data." },
      { status: 400, headers: errorHeaders },
    );
  }
  if (propertyDraft?.success && propertyDraft.data.slug !== record.slug) {
    return NextResponse.json(
      { error: "Preview property does not match this record." },
      { status: 400, headers: errorHeaders },
    );
  }
  const sourceProperty = propertyDraft?.success
    ? propertyDraft.data
    : record.property;
  const galleryIds = new Set(sourceProperty.gallery.map((image) => image.id));
  const unknownFocalPoint = parsed.data.focalPoints.find(
    (item) => !galleryIds.has(item.mediaId),
  );
  if (unknownFocalPoint) {
    return NextResponse.json(
      { error: "Preview focal points must reference an existing gallery image." },
      { status: 400, headers: errorHeaders },
    );
  }
  const selectedIds = [
    parsed.data.marketingMaterials.brochure?.primaryMediaId,
    ...(parsed.data.marketingMaterials.brochure?.supportingMediaIds ?? []),
  ].filter((id): id is string => Boolean(id));
  if (selectedIds.some((id) => !galleryIds.has(id))) {
    return NextResponse.json(
      { error: "Preview photos must reference the existing property gallery." },
      { status: 400, headers: errorHeaders },
    );
  }

  const focalPoints = new Map(
    parsed.data.focalPoints.map((item) => [item.mediaId, item.focalPoint]),
  );
  const property = {
    ...sourceProperty,
    marketingMaterials: parsed.data.marketingMaterials,
    gallery: sourceProperty.gallery.map((image) => ({
      ...image,
      focalPoint: focalPoints.get(image.id) ?? image.focalPoint,
    })),
  };

  return createPropertyMarketingPreviewResponse({
    property,
    canonicalUrl: absoluteUrl(`/property/${record.slug}`),
  });
}
