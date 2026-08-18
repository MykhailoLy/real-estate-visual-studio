// ============================================================
// IMAGE ENHANCEMENT — typed configuration
//
// Single source of truth for the Image Enhancement type selector,
// the Single Exposure order form, server-side validation, persisted
// detail labels, and the admin-managed selector / day-sky media keys.
//
// SCOPE / PRICING: this module does NOT define prices. The Single
// Exposure subtotal is derived from the existing PHOTO_EDIT_OPTIONS
// option `image-enhancement-re` (fixed by currency in the canonical catalog).
// HDR has no active order form yet and
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
// Single Exposure optional add-ons
// -----------------------------------------------------------
export interface SingleExposureStandardAddOn {
  /** Stable PHOTO_EDIT_OPTIONS id submitted for pricing and fulfilment. */
  id: SingleExposureStandardAddOnId;
  label: string;
  priceKey: import("./pricing/types").PriceKey;
  /** Existing shared Virtual Staging keys stay the media source of truth. */
  mediaKey: string;
  description: string;
}

export type SingleExposureStandardAddOnId =
  | "item-removal-cleaning-pe"
  | "shadow-removal"
  | "turn-on-lights-pe"
  | "colour-change-pe";

export const SINGLE_EXPOSURE_STANDARD_ADDONS: SingleExposureStandardAddOn[] = [
  {
    id: "item-removal-cleaning-pe",
    label: "Item Removal & Virtual Cleaning",
    priceKey: "item-removal-virtual-cleaning",
    mediaKey: "virtual-staging-addon-item-removal",
    description:
      "Removes unwanted furniture, clutter or selected objects to prepare a clean space for presentation.",
  },
  {
    id: "shadow-removal",
    label: "Shadow Removal",
    priceKey: "shadow-removal",
    mediaKey: "shared-addon-shadow-removal",
    description:
      "Removes unwanted photographer, camera, flash or harsh cast shadows while preserving natural depth.",
  },
  {
    id: "turn-on-lights-pe",
    label: "Turn On Lights",
    priceKey: "turn-on-lights",
    mediaKey: "virtual-staging-addon-turn-on-lights",
    description:
      "Makes existing light fixtures appear naturally illuminated without adding new fixtures.",
  },
  {
    id: "colour-change-pe",
    label: "Colour Change",
    priceKey: "colour-change",
    mediaKey: "virtual-staging-addon-colour-change",
    description:
      "Changes requested colours of selected walls, finishes, furniture or other visible elements.",
  },
];

export const SINGLE_EXPOSURE_STANDARD_ADDON_IDS =
  SINGLE_EXPOSURE_STANDARD_ADDONS.map((addon) => addon.id);

export function isSingleExposureStandardAddOnId(
  value: unknown,
): value is SingleExposureStandardAddOnId {
  return (
    typeof value === "string" &&
    SINGLE_EXPOSURE_STANDARD_ADDONS.some((addon) => addon.id === value)
  );
}

export function normalizeSingleExposureStandardAddOns(
  values: readonly unknown[],
): SingleExposureStandardAddOnId[] {
  return [...new Set(values.filter(isSingleExposureStandardAddOnId))];
}

export const AERIAL_EDITING_ID_VALUES = [
  "none",
  "colour-fade",
  "drop-pin",
  "single-lot-highlight",
  "multiple-lot-highlight",
  "full-markup",
] as const;

export type AerialEditingId = (typeof AERIAL_EDITING_ID_VALUES)[number];

export interface AerialEditingOption {
  id: AerialEditingId;
  label: string;
  optionId: string | null;
  priceKey: import("./pricing/types").PriceKey | null;
  mediaKey: string | null;
  description: string;
  requiresDetails: boolean;
}

export const AERIAL_EDITING_OPTIONS: AerialEditingOption[] = [
  {
    id: "none",
    label: "No Aerial Editing",
    optionId: null,
    priceKey: null,
    mediaKey: null,
    description:
      "Choose an aerial editing option when the uploaded photo needs a fade, pin, lot highlight or full markup.",
    requiresDetails: false,
  },
  {
    id: "colour-fade",
    label: "Aerial Colour Fade",
    optionId: "aerial-colour-fade-pe",
    priceKey: "aerial-colour-fade",
    mediaKey: "image-enhancement-aerial-colour-fade",
    description:
      "Softly de-emphasises the surrounding area so attention remains on the selected property.",
    requiresDetails: false,
  },
  {
    id: "drop-pin",
    label: "Aerial Drop Pin",
    optionId: "aerial-drop-pin-pe",
    priceKey: "aerial-drop-pin",
    mediaKey: "image-enhancement-aerial-drop-pin",
    description:
      "Adds a clear location marker to identify the property or an important nearby feature.",
    requiresDetails: true,
  },
  {
    id: "single-lot-highlight",
    label: "Single Lot Highlight",
    optionId: "aerial-single-lot-highlight-pe",
    priceKey: "aerial-single-lot-highlight",
    mediaKey: "image-enhancement-aerial-single-lot-highlight",
    description:
      "Highlights one property boundary using the supplied reference or instructions.",
    requiresDetails: true,
  },
  {
    id: "multiple-lot-highlight",
    label: "Multiple Lot Highlight — up to 5 lots",
    optionId: "aerial-multiple-lot-highlight-pe",
    priceKey: "aerial-multiple-lot-highlight",
    mediaKey: "image-enhancement-aerial-multiple-lot-highlight",
    description:
      "Highlights up to five individual lots using the supplied reference or marked screenshot.",
    requiresDetails: true,
  },
  {
    id: "full-markup",
    label: "Full Aerial Markup — highlight, fade and pin",
    optionId: "aerial-full-markup-pe",
    priceKey: "aerial-full-markup",
    mediaKey: "image-enhancement-aerial-full-markup",
    description:
      "Combines a property highlight, surrounding-area fade and location pin in one aerial image.",
    requiresDetails: true,
  },
];

export const AERIAL_EDITING_DEFAULT: AerialEditingId = "none";

export const AERIAL_EDITING_OPTION_IDS = AERIAL_EDITING_OPTIONS.flatMap(
  (option) => (option.optionId ? [option.optionId] : []),
);

export function isAerialEditingId(value: unknown): value is AerialEditingId {
  return (
    typeof value === "string" &&
    (AERIAL_EDITING_ID_VALUES as readonly string[]).includes(value)
  );
}

export function getAerialEditingOption(value: unknown): AerialEditingOption {
  return (
    AERIAL_EDITING_OPTIONS.find((option) => option.id === value) ??
    AERIAL_EDITING_OPTIONS[0]
  );
}

export function isAerialDetailRequirementSatisfied(
  aerialEditing: unknown,
  instructions: unknown,
  hasReference: boolean,
): boolean {
  const aerial = getAerialEditingOption(aerialEditing);
  return (
    !aerial.requiresDetails ||
    (typeof instructions === "string" && instructions.trim().length > 0) ||
    hasReference
  );
}

export function getSingleExposureSelectedOptions(
  selectedAddons: readonly unknown[],
  aerialEditing: unknown,
): string[] {
  const aerialOption = getAerialEditingOption(aerialEditing);
  return [
    SINGLE_EXPOSURE_OPTION_ID,
    ...normalizeSingleExposureStandardAddOns(selectedAddons),
    ...(aerialOption.optionId ? [aerialOption.optionId] : []),
  ];
}

export function isDaySkyStyleActive(
  skyReplacement: unknown,
): skyReplacement is "yes" {
  return skyReplacement === "yes";
}

export function getEffectiveDaySkyStyle(
  skyReplacement: unknown,
  daySkyStyle: unknown,
): DaySkyStyleId | null {
  if (!isDaySkyStyleActive(skyReplacement)) return null;
  return isDaySkyStyleId(daySkyStyle) ? daySkyStyle : DAY_SKY_STYLE_DEFAULT;
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
    priceLabel: "Fixed price per image",
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

/** Published examples used by the authenticated Single Exposure order form. */
export const SINGLE_EXPOSURE_ORDER_MEDIA_KEYS: string[] = [
  ...DAY_SKY_STYLES.map((style) => style.mediaKey),
  ...SINGLE_EXPOSURE_STANDARD_ADDONS.map((addon) => addon.mediaKey),
  ...AERIAL_EDITING_OPTIONS.flatMap((option) =>
    option.mediaKey ? [option.mediaKey] : [],
  ),
];
