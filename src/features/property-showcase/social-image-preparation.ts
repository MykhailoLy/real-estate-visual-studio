import sharp from "sharp";
import {
  loadPropertySocialImageSource,
  PROPERTY_SOCIAL_IMAGE_FETCH_TIMEOUT_MS,
  PROPERTY_SOCIAL_IMAGE_MAX_SOURCE_BYTES,
  type PropertySocialImageFailureReason,
  type PropertySocialImageFetch,
  type PropertySocialImageKind,
  type PropertySocialImageSourceResult,
} from "./social-image-source.ts";
import {
  getPropertySocialPreview,
  resolvedPropertySocialImages,
  type PropertySocialPreview,
} from "./social-preview.ts";
import type { PropertyShowcase } from "./types.ts";
import type { PropertyImageFocalPoint } from "./types.ts";

export const PROPERTY_SOCIAL_IMAGE_MAX_PHOTOS = 3;
export const PROPERTY_SOCIAL_IMAGE_MAX_LOGOS = 1;
export const PROPERTY_SOCIAL_IMAGE_PROCESS_TIMEOUT_MS = 4000;
export const PROPERTY_SOCIAL_IMAGE_PRIMARY_MAX_BYTES = 450 * 1024;
export const PROPERTY_SOCIAL_IMAGE_SUPPORT_MAX_BYTES = 220 * 1024;
export const PROPERTY_SOCIAL_IMAGE_LOGO_MAX_BYTES = 100 * 1024;
export const PROPERTY_SOCIAL_IMAGE_TOTAL_MAX_BYTES = 1024 * 1024;
export const PROPERTY_SOCIAL_IMAGE_MAX_CANDIDATE_ATTEMPTS = 12;

export const PROPERTY_SOCIAL_IMAGE_EVENTS = {
  lookupFailed: "property-social-image.lookup-failed",
  preparationFailed: "property-social-image.preparation-failed",
  sourceSkipped: "property-social-image.source-skipped",
  normalizeFailed: "property-social-image.normalize-failed",
  budgetSkipped: "property-social-image.budget-skipped",
  renderFailed: "property-social-image.render-failed",
  emergencyFallback: "property-social-image.emergency-fallback",
} as const;

export interface PropertySocialImageLimits {
  maxSourceBytes: number;
  fetchTimeoutMs: number;
  processTimeoutMs: number;
  primaryMaxBytes: number;
  supportMaxBytes: number;
  logoMaxBytes: number;
  cumulativeMaxBytes: number;
  maxPhotos: number;
  maxLogos: number;
  maxCandidateAttempts: number;
}

export const DEFAULT_PROPERTY_SOCIAL_IMAGE_LIMITS: PropertySocialImageLimits = {
  maxSourceBytes: PROPERTY_SOCIAL_IMAGE_MAX_SOURCE_BYTES,
  fetchTimeoutMs: PROPERTY_SOCIAL_IMAGE_FETCH_TIMEOUT_MS,
  processTimeoutMs: PROPERTY_SOCIAL_IMAGE_PROCESS_TIMEOUT_MS,
  primaryMaxBytes: PROPERTY_SOCIAL_IMAGE_PRIMARY_MAX_BYTES,
  supportMaxBytes: PROPERTY_SOCIAL_IMAGE_SUPPORT_MAX_BYTES,
  logoMaxBytes: PROPERTY_SOCIAL_IMAGE_LOGO_MAX_BYTES,
  cumulativeMaxBytes: PROPERTY_SOCIAL_IMAGE_TOTAL_MAX_BYTES,
  maxPhotos: PROPERTY_SOCIAL_IMAGE_MAX_PHOTOS,
  maxLogos: PROPERTY_SOCIAL_IMAGE_MAX_LOGOS,
  maxCandidateAttempts: PROPERTY_SOCIAL_IMAGE_MAX_CANDIDATE_ATTEMPTS,
};

export type PropertySocialImageLog = (
  event: (typeof PROPERTY_SOCIAL_IMAGE_EVENTS)[keyof typeof PROPERTY_SOCIAL_IMAGE_EVENTS],
  details: Readonly<Record<string, string | number | boolean>>,
) => void;

export interface PreparedPropertySocialImage {
  imageId?: string;
  imageUrl: string;
  imageAlt: string;
  focalPoint?: PropertyImageFocalPoint;
  byteLength: number;
  contentType: "image/jpeg";
}

export interface PreparedPropertySocialLogo {
  imageUrl: string;
  byteLength: number;
  contentType: "image/png";
}

export interface PreparedPropertySocialAssets {
  preview: PropertySocialPreview;
  propertyImages: PreparedPropertySocialImage[];
  brandingLogo: PreparedPropertySocialLogo | null;
  candidateCount: number;
  skippedPhotoCount: number;
  totalBytes: number;
}

type PropertySocialImageSourceLoader = (
  property: Pick<PropertyShowcase, "slug">,
  imageUrl: string,
  kind: PropertySocialImageKind,
  options: {
    fetchImpl?: PropertySocialImageFetch;
    timeoutMs?: number;
    maxSourceBytes?: number;
  },
) => Promise<PropertySocialImageSourceResult>;

interface PreparePropertySocialImageOptions {
  fetchImpl?: PropertySocialImageFetch;
  limits?: Partial<PropertySocialImageLimits>;
  log?: PropertySocialImageLog;
  sourceLoader?: PropertySocialImageSourceLoader;
}

function defaultLog(
  event: Parameters<PropertySocialImageLog>[0],
  details: Parameters<PropertySocialImageLog>[1],
) {
  console.warn(event, details);
}

function toDataUri(contentType: "image/jpeg" | "image/png", bytes: Buffer) {
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

function sharpTimeoutSeconds(timeoutMs: number): number {
  return Math.max(1, Math.ceil(timeoutMs / 1000));
}

async function normalizePhoto(
  source: Buffer,
  role: "primary" | "support",
  limits: PropertySocialImageLimits,
): Promise<Buffer> {
  const primary = role === "primary";
  return sharp(source, {
    failOn: "error",
    limitInputPixels: 50_000_000,
    sequentialRead: true,
  })
    .rotate()
    .resize({
      width: primary ? 760 : 380,
      height: primary ? 630 : 220,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: primary ? 82 : 80,
      mozjpeg: true,
    })
    .timeout({ seconds: sharpTimeoutSeconds(limits.processTimeoutMs) })
    .toBuffer();
}

async function normalizeLogo(
  source: Buffer,
  limits: PropertySocialImageLimits,
): Promise<Buffer> {
  return sharp(source, {
    failOn: "error",
    limitInputPixels: 20_000_000,
    sequentialRead: true,
  })
    .rotate()
    .resize({
      width: 160,
      height: 80,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .timeout({ seconds: sharpTimeoutSeconds(limits.processTimeoutMs) })
    .toBuffer();
}

function logSourceFailure(
  log: PropertySocialImageLog,
  slug: string,
  role: "primary" | "support" | "logo",
  candidateIndex: number,
  reason: PropertySocialImageFailureReason,
) {
  log(PROPERTY_SOCIAL_IMAGE_EVENTS.sourceSkipped, {
    slug,
    role,
    candidateIndex,
    reason,
  });
}

export async function preparePropertySocialAssets(
  property: PropertyShowcase,
  options: PreparePropertySocialImageOptions = {},
): Promise<PreparedPropertySocialAssets> {
  const limits = {
    ...DEFAULT_PROPERTY_SOCIAL_IMAGE_LIMITS,
    ...options.limits,
  };
  const log = options.log ?? defaultLog;
  const sourceLoader = options.sourceLoader ?? loadPropertySocialImageSource;
  const preview = getPropertySocialPreview(property);
  const candidates = resolvedPropertySocialImages(property);
  const propertyImages: PreparedPropertySocialImage[] = [];
  let totalBytes = 0;
  let skippedPhotoCount = 0;

  for (const [candidateIndex, candidate] of candidates
    .slice(0, limits.maxCandidateAttempts)
    .entries()) {
    if (propertyImages.length >= limits.maxPhotos) break;
    const role = propertyImages.length === 0 ? "primary" : "support";
    const source = await sourceLoader(
      property,
      candidate.imageUrl,
      "photo",
      {
        fetchImpl: options.fetchImpl,
        timeoutMs: limits.fetchTimeoutMs,
        maxSourceBytes: limits.maxSourceBytes,
      },
    );
    if (!source.ok) {
      skippedPhotoCount += 1;
      logSourceFailure(log, property.slug, role, candidateIndex, source.reason);
      continue;
    }

    let normalized: Buffer;
    try {
      normalized = await normalizePhoto(source.source.bytes, role, limits);
    } catch {
      skippedPhotoCount += 1;
      log(PROPERTY_SOCIAL_IMAGE_EVENTS.normalizeFailed, {
        slug: property.slug,
        role,
        candidateIndex,
        reason: "decode-or-normalize-failed",
      });
      continue;
    }

    const maxOutputBytes =
      role === "primary" ? limits.primaryMaxBytes : limits.supportMaxBytes;
    if (normalized.length > maxOutputBytes) {
      skippedPhotoCount += 1;
      log(PROPERTY_SOCIAL_IMAGE_EVENTS.budgetSkipped, {
        slug: property.slug,
        role,
        candidateIndex,
        reason: "per-image-output-limit",
        byteLength: normalized.length,
      });
      continue;
    }
    if (totalBytes + normalized.length > limits.cumulativeMaxBytes) {
      skippedPhotoCount += 1;
      log(PROPERTY_SOCIAL_IMAGE_EVENTS.budgetSkipped, {
        slug: property.slug,
        role,
        candidateIndex,
        reason: "cumulative-output-limit",
        byteLength: normalized.length,
      });
      continue;
    }

    propertyImages.push({
      imageId: candidate.imageId,
      imageUrl: toDataUri("image/jpeg", normalized),
      imageAlt: candidate.imageAlt,
      focalPoint: candidate.focalPoint ?? { x: 0.5, y: 0.5 },
      byteLength: normalized.length,
      contentType: "image/jpeg",
    });
    totalBytes += normalized.length;
  }

  let brandingLogo: PreparedPropertySocialLogo | null = null;
  if (
    limits.maxLogos > 0 &&
    preview.brandingMode === "agency" &&
    preview.brandingLogoUrl
  ) {
    const source = await sourceLoader(
      property,
      preview.brandingLogoUrl,
      "logo",
      {
        fetchImpl: options.fetchImpl,
        timeoutMs: limits.fetchTimeoutMs,
        maxSourceBytes: limits.maxSourceBytes,
      },
    );
    if (!source.ok) {
      logSourceFailure(log, property.slug, "logo", 0, source.reason);
    } else {
      try {
        const normalized = await normalizeLogo(source.source.bytes, limits);
        if (
          normalized.length > limits.logoMaxBytes ||
          totalBytes + normalized.length > limits.cumulativeMaxBytes
        ) {
          log(PROPERTY_SOCIAL_IMAGE_EVENTS.budgetSkipped, {
            slug: property.slug,
            role: "logo",
            candidateIndex: 0,
            reason:
              normalized.length > limits.logoMaxBytes
                ? "per-image-output-limit"
                : "cumulative-output-limit",
            byteLength: normalized.length,
          });
        } else {
          brandingLogo = {
            imageUrl: toDataUri("image/png", normalized),
            byteLength: normalized.length,
            contentType: "image/png",
          };
          totalBytes += normalized.length;
        }
      } catch {
        log(PROPERTY_SOCIAL_IMAGE_EVENTS.normalizeFailed, {
          slug: property.slug,
          role: "logo",
          candidateIndex: 0,
          reason: "decode-or-normalize-failed",
        });
      }
    }
  }

  return {
    preview,
    propertyImages,
    brandingLogo,
    candidateCount: candidates.length,
    skippedPhotoCount,
    totalBytes,
  };
}
