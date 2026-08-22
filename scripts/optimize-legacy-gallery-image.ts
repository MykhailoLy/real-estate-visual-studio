import sharp from "sharp";
import { IMAGE_PROFILE_SETTINGS } from "../src/lib/image-profile-settings.ts";
import type { OptimizedGalleryImage } from "./public-media-backfill-core.ts";

const MAX_SOURCE_PIXELS = 100_000_000;
const RESIZE_PASSES = 4;

function qualitySteps(): number[] {
  const settings = IMAGE_PROFILE_SETTINGS.gallery;
  return [
    settings.initialQuality,
    Math.max(settings.minimumQuality, settings.initialQuality - 0.06),
    Math.max(settings.minimumQuality, settings.initialQuality - 0.12),
    settings.minimumQuality,
  ].filter((quality, index, qualities) => qualities.indexOf(quality) === index);
}

export async function optimizeLegacyGalleryImage(
  source: Uint8Array,
  mimeType: string,
): Promise<OptimizedGalleryImage> {
  if (!mimeType.toLowerCase().startsWith("image/")) {
    throw new Error(`Refusing to decode non-image MIME type ${mimeType}.`);
  }
  const settings = IMAGE_PROFILE_SETTINGS.gallery;
  const metadata = await sharp(source, {
    failOn: "error",
    limitInputPixels: MAX_SOURCE_PIXELS,
    animated: false,
  }).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Sharp could not determine source image dimensions.");
  }
  if ((metadata.pages ?? 1) > 1) {
    throw new Error("Animated or multi-page images are not supported by this backfill.");
  }

  const originalLongSide = Math.max(metadata.width, metadata.height);
  let maxLongSide = Math.min(originalLongSide, settings.maxLongSide);
  let best: OptimizedGalleryImage | null = null;

  for (let resizePass = 0; resizePass < RESIZE_PASSES; resizePass += 1) {
    for (const quality of qualitySteps()) {
      const { data, info } = await sharp(source, {
        failOn: "error",
        limitInputPixels: MAX_SOURCE_PIXELS,
        animated: false,
      })
        .rotate()
        .resize({
          width: maxLongSide,
          height: maxLongSide,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: Math.round(quality * 100) })
        .toBuffer({ resolveWithObject: true });

      const optimized: OptimizedGalleryImage = {
        bytes: data,
        width: info.width,
        height: info.height,
        quality,
        targetMet: data.byteLength <= settings.targetBytes,
      };
      if (!best || data.byteLength < best.bytes.byteLength) best = optimized;
      if (optimized.targetMet) return optimized;
    }

    if (maxLongSide <= settings.minLongSide) break;
    maxLongSide = Math.max(
      settings.minLongSide,
      Math.round(maxLongSide * 0.85),
    );
  }

  if (!best) throw new Error("Sharp did not produce a WebP image.");
  return best;
}
