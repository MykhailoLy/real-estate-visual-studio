// ============================================================
// IMAGE ENHANCEMENT — typed configuration
//
// Single source of truth for the Image Enhancement type selector,
// the Single Exposure order form, server-side validation, persisted
// detail labels, and the admin-managed selector / day-sky media keys.
//
// SCOPE / PRICING: this module does NOT define prices. The Single
// Exposure subtotal is derived from the existing PHOTO_EDIT_OPTIONS
// option `image-enhancement-re` (200 cents). HDR has no price yet and
// is intentionally non-submittable.
// ============================================================

// -----------------------------------------------------------
// Sub-service slugs (mirrors src/lib/dedicated-photo-editing.ts)
// -----------------------------------------------------------
/** New Single Exposure orders. */
export const SINGLE_EXPOSURE_SUB_SERVICE = "image-enhancement-single-exposure";
export const SINGLE_EXPOSURE_SUB_SERVICE_LABEL =
  "Image Enhancement \u2014 Single Exposure";
/** Legacy Image Enhancement orders from merged PR 106. */
export const LEGACY_IMAGE_ENHANCEMENT_SUB_SERVICE = "image-enhancement";

/** The fixed PHOTO_EDIT_OPTIONS id every Single Exposure item submits. */
export const SINGLE_EXPOSURE_OPTION_ID = "image-enhancement-re";

// -----------------------------------------------------------
// Three-state preference control
// -----------------------------------------------------------
export const THREE_STATE_VALUES = ["expert-decide", "yes", "no"] as const;
export type ThreeStateValue = (typeof THREE_STATE_VALUES)[number];

export const THREE_STATE_DEFAULT: ThreeStateValue = "expert-decide";

export const THREE_STATE_LABELS: Record<ThreeStateValue, string> = {
  "expert-decide": "Let Our Experts Decide",
  yes: "Yes",
  no: "No",
};

export function isThreeStateValue(value: unknown): value is ThreeStateValue {
  return (
    typeof value === "string" &&
    (THREE_STATE_VALUES as readonly string[]).includes(value)
  );
}

/** Server-side safe label derivation for a three-state value. */
export function getThreeStateLabel(value: unknown): string {
  return THREE_STATE_LABELS[isThreeStateValue(value) ? value : THREE_STATE_DEFAULT];
}

// -----------------------------------------------------------
// Single Exposure preferences (four three-state controls, all
// included in the base price — they never change the subtotal).
// -----------------------------------------------------------
export interface SingleExposurePreferenceConfig {
  /** snake_case persistence key in order_items.details. */
  key: SingleExposurePreferenceKey;
  /** camelCase key on the client item state / payload. */
  field: SingleExposurePreferenceField;
  /** Human label shown in the form and in displays. */
  label: string;
}

export type SingleExposurePreferenceKey =
  | "grass_repair"
  | "sky_replacement"
  | "tv_screen_replacement"
  | "add_fire_to_fireplace";

export type SingleExposurePreferenceField =
  | "grassRepair"
  | "skyReplacement"
  | "tvScreenReplacement"
  | "addFireToFireplace";

export const SINGLE_EXPOSURE_PREFERENCES: SingleExposurePreferenceConfig[] = [
  { key: "grass_repair", field: "grassRepair", label: "Grass Repair or Replacement" },
  { key: "sky_replacement", field: "skyReplacement", label: "Sky Replacement" },
  {
    key: "tv_screen_replacement",
    field: "tvScreenReplacement",
    label: "TV Screen Replacement",
  },
  {
    key: "add_fire_to_fireplace",
    field: "addFireToFireplace",
    label: "Add Fire to Fireplace",
  },
];

// -----------------------------------------------------------
// Day Sky Styles (visual radio cards, one selected, in base price)
// -----------------------------------------------------------
export interface DaySkyStyleConfig {
  id: DaySkyStyleId;
  label: string;
  /** Admin-managed service-options media key for this style's example. */
  mediaKey: string;
}

export type DaySkyStyleId =
  | "expert-decide"
  | "bold-blue"
  | "soft-windswept"
  | "bright-clouds"
  | "deep-blue"
  | "soft-pastel";

/** Const tuple of day-sky ids (for zod enums and exhaustive checks). */
export const DAY_SKY_STYLE_ID_VALUES = [
  "expert-decide",
  "bold-blue",
  "soft-windswept",
  "bright-clouds",
  "deep-blue",
  "soft-pastel",
] as const;

export const DAY_SKY_STYLES: DaySkyStyleConfig[] = [
  {
    id: "expert-decide",
    label: "Let Our Experts Decide",
    mediaKey: "image-enhancement-day-sky-expert-decide",
  },
  {
    id: "bold-blue",
    label: "Bold Blue Sky",
    mediaKey: "image-enhancement-day-sky-bold-blue",
  },
  {
    id: "soft-windswept",
    label: "Soft Windswept Clouds",
    mediaKey: "image-enhancement-day-sky-windswept",
  },
  {
    id: "bright-clouds",
    label: "Bright Blue with White Clouds",
    mediaKey: "image-enhancement-day-sky-bright-clouds",
  },
  {
    id: "deep-blue",
    label: "Deep Blue Sky",
    mediaKey: "image-enhancement-day-sky-deep-blue",
  },
  {
    id: "soft-pastel",
    label: "Soft Pastel Sky",
    mediaKey: "image-enhancement-day-sky-pastel",
  },
];

export const DAY_SKY_STYLE_DEFAULT: DaySkyStyleId = "expert-decide";

export const DAY_SKY_STYLE_IDS: DaySkyStyleId[] = [...DAY_SKY_STYLE_ID_VALUES];

export function isDaySkyStyleId(value: unknown): value is DaySkyStyleId {
  return (
    typeof value === "string" &&
    DAY_SKY_STYLES.some((s) => s.id === value)
  );
}

/** Server-side safe label derivation for a day-sky style id. */
export function getDaySkyStyleLabel(value: unknown): string {
  const match = DAY_SKY_STYLES.find((s) => s.id === value);
  const fallback = DAY_SKY_STYLES.find((s) => s.id === DAY_SKY_STYLE_DEFAULT)!;
  return (match ?? fallback).label;
}

// -----------------------------------------------------------
// Type selector
// -----------------------------------------------------------
export interface ImageEnhancementType {
  id: "single-exposure" | "hdr-bracketed";
  title: string;
  description: string;
  /** "1 source image = 1 final image" style relationship line. */
  relationship: string;
  /** Price/status text. */
  priceLabel: string;
  ctaLabel: string;
  /** Route for the active type; null when not submittable yet. */
  route: string;
  /** Informational route (always present); for HDR it has no form. */
  status: "active" | "coming-soon";
  /** Admin-managed service-options media key for the card image. */
  mediaKey: string;
}

export const IMAGE_ENHANCEMENT_TYPES: ImageEnhancementType[] = [
  {
    id: "single-exposure",
    title: "Image Enhancement \u2014 Single Exposure",
    description:
      "For standard real-estate photographs. One uploaded source image produces one professionally enhanced final image.",
    relationship: "1 source image = 1 final image",
    priceLabel: "US$2 per image",
    ctaLabel: "Start Single Exposure Order",
    route: "/dashboard/orders/new/image-enhancement/single-exposure",
    status: "active",
    mediaKey: "image-enhancement-type-single-exposure",
  },
  {
    id: "hdr-bracketed",
    title: "Image Enhancement \u2014 HDR / Bracketed Images",
    description:
      "For professional photographers uploading multiple exposures or brackets for each final real-estate image.",
    relationship: "Multiple exposures = 1 final image",
    priceLabel: "Pricing to be confirmed",
    ctaLabel: "Coming Soon",
    route: "/dashboard/orders/new/image-enhancement/hdr-bracketed",
    status: "coming-soon",
    mediaKey: "image-enhancement-type-hdr-bracketed",
  },
];

/** All service-options media keys used by the Image Enhancement surfaces. */
export const IMAGE_ENHANCEMENT_MEDIA_KEYS: string[] = [
  ...IMAGE_ENHANCEMENT_TYPES.map((t) => t.mediaKey),
  ...DAY_SKY_STYLES.map((s) => s.mediaKey),
];
