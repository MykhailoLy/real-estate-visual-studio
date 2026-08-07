import "server-only";

import {
  type PropertyCustomFlyerFormat,
  validatePropertyCustomFlyerBinary,
} from "./custom-flyer.ts";
import { ownedPropertyCustomFlyerStoragePath } from "./storage-cleanup.ts";
import type { PropertyCustomFlyerFiles } from "./types.ts";
import { SITE_MEDIA_BUCKET } from "@/lib/site-media";
import { createServerClient } from "@/lib/supabase";

export async function verifyStoredPropertyCustomFlyer(params: {
  slug: string;
  format: PropertyCustomFlyerFormat;
  value: string;
}): Promise<{ ok: true; path: string; publicUrl: string } | { ok: false; error: string }> {
  const path = ownedPropertyCustomFlyerStoragePath(params.value, params.slug, {
    allowRelativeObjectPath: true,
  });
  if (!path) return { ok: false, error: "Custom flyer files must belong to this property." };

  const supabase = createServerClient();
  const { data, error } = await supabase.storage.from(SITE_MEDIA_BUCKET).download(path);
  if (error || !data) return { ok: false, error: "The uploaded flyer file could not be verified." };

  const bytes = new Uint8Array(await data.arrayBuffer());
  const binaryError = validatePropertyCustomFlyerBinary({
    format: params.format,
    contentType: data.type,
    bytes,
  });
  if (binaryError) return { ok: false, error: binaryError };

  const { data: publicData } = supabase.storage
    .from(SITE_MEDIA_BUCKET)
    .getPublicUrl(path);
  if (!publicData.publicUrl) return { ok: false, error: "Could not resolve the flyer URL." };
  return { ok: true, path, publicUrl: publicData.publicUrl };
}

export async function verifyStoredPropertyCustomFlyerFiles(params: {
  slug: string;
  files: PropertyCustomFlyerFiles | undefined;
}): Promise<{ ok: true; files: PropertyCustomFlyerFiles } | { ok: false; error: string }> {
  const files: PropertyCustomFlyerFiles = {};
  for (const format of ["pdf", "jpg", "png"] as const) {
    const value = params.files?.[format];
    if (!value) continue;
    const verified = await verifyStoredPropertyCustomFlyer({
      slug: params.slug,
      format,
      value,
    });
    if (!verified.ok) return verified;
    files[format] = verified.publicUrl;
  }
  return { ok: true, files };
}
