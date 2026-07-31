import "server-only";

import { createServerClient } from "@/lib/supabase";
import type {
  PropertyShowcaseAdminListResult,
  PropertyShowcaseAdminRecord,
} from "./admin-types";
import {
  isPublicSupabaseObjectUrl,
  repairPropertyMediaUrl,
} from "./provider-urls";
import { PropertyShowcaseSchema } from "./schema";
import type { PropertyShowcase } from "./types";

interface PropertyShowcaseDatabaseRow {
  id: string;
  slug: string;
  content: unknown;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const MISSING_SCHEMA_CODES = new Set(["42P01", "PGRST205"]);

export function isPropertyShowcaseSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function repairStoredProperty(property: PropertyShowcase): PropertyShowcase {
  const coverImage = repairPropertyMediaUrl(property.coverImage) ?? property.coverImage;
  const floorPlans = property.floorPlans.map((plan) => {
    const repairedImage = repairPropertyMediaUrl(plan.imageUrl);
    const repairedDownload = repairPropertyMediaUrl(plan.downloadUrl);
    const imageUrl =
      repairedImage && isPublicSupabaseObjectUrl(repairedImage)
        ? repairedImage
        : repairedDownload && isPublicSupabaseObjectUrl(repairedDownload)
          ? repairedDownload
          : repairedImage ?? plan.imageUrl;

    return {
      ...plan,
      imageUrl,
      downloadUrl: repairedDownload ?? plan.downloadUrl,
    };
  });
  const hasExternalInteractivePlan = floorPlans.some((plan) =>
    Boolean(plan.interactiveUrl),
  );
  const hasNativeRoomLinks = property.gallery.some((image) =>
    Boolean(image.roomId),
  );
  const gallery = property.gallery.map((image, index) => ({
    ...image,
    src: repairPropertyMediaUrl(image.src) ?? image.src,
    roomId:
      image.roomId ??
      (hasExternalInteractivePlan && !hasNativeRoomLinks && index === 0
        ? "external-interactive-plan"
        : undefined),
  }));

  return {
    ...property,
    coverImage,
    gallery,
    floorPlans,
    virtualTour: property.virtualTour
      ? {
          ...property.virtualTour,
          posterImage:
            repairPropertyMediaUrl(property.virtualTour.posterImage) ??
            property.virtualTour.posterImage,
        }
      : undefined,
  };
}

function parseRow(
  row: PropertyShowcaseDatabaseRow,
): PropertyShowcaseAdminRecord | null {
  const parsed = PropertyShowcaseSchema.safeParse(row.content);
  if (!parsed.success || parsed.data.slug !== row.slug) {
    console.error("property-showcase: invalid stored content", {
      id: row.id,
      slug: row.slug,
    });
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    published: row.published,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    property: repairStoredProperty(parsed.data),
  };
}

export async function getPropertyShowcasesForAdmin(): Promise<PropertyShowcaseAdminListResult> {
  if (!isPropertyShowcaseSupabaseConfigured()) {
    return { records: [], schemaReady: false };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("property_showcases")
      .select("id, slug, content, published, published_at, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      if (!MISSING_SCHEMA_CODES.has(error.code)) {
        console.error("property-showcase: admin list unavailable", {
          code: error.code,
        });
      }
      return { records: [], schemaReady: false };
    }

    const records = (data as PropertyShowcaseDatabaseRow[])
      .map(parseRow)
      .filter((record): record is PropertyShowcaseAdminRecord => record !== null);

    return { records, schemaReady: true };
  } catch (error) {
    console.error("property-showcase: admin list init failed", error);
    return { records: [], schemaReady: false };
  }
}

export async function getPublishedPropertyShowcase(
  slug: string,
): Promise<PropertyShowcase | null> {
  if (!isPropertyShowcaseSupabaseConfigured()) return null;

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("property_showcases")
      .select("id, slug, content, published, published_at, created_at, updated_at")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();

    if (error || !data) {
      if (
        error &&
        error.code !== "PGRST116" &&
        !MISSING_SCHEMA_CODES.has(error.code)
      ) {
        console.error("property-showcase: public read unavailable", {
          code: error.code,
          slug,
        });
      }
      return null;
    }

    return parseRow(data as PropertyShowcaseDatabaseRow)?.property ?? null;
  } catch (error) {
    console.error("property-showcase: public read init failed", error);
    return null;
  }
}
