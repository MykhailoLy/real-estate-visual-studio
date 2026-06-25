// ============================================================
// DAY TO DUSK — typed configuration
//
// Single source of truth for the Day to Dusk visual dusk-sky-style
// selector, the lighting preferences, the dedicated order form,
// server-side validation, persisted detail labels, and the
// admin-managed selector media keys.
//
// This module is PURE (no React, no server-only imports) so it can
// be shared by the client form AND the server (validation, /api/order
// details, display labels, email).
//
// SCOPE / PRICING: this module does NOT define prices. The Day to Dusk
// subtotal is derived from the EXISTING PHOTO_EDIT_OPTIONS option
// `day-to-dusk-pe` (fixed by currency in the canonical catalog). Every dusk style and lighting
// preference below is INCLUDED in that base price and never changes
// the subtotal — there is no lights surcharge and no paid extra.
// ============================================================

/** The dedicated sub-service slug for Day to Dusk orders. */
export const DAY_TO_DUSK_SUB_SERVICE = "day-to-dusk";

/** The fixed PHOTO_EDIT_OPTIONS id every Day to Dusk item submits. */
export const DAY_TO_DUSK_OPTION_ID = "day-to-dusk-pe";

// -----------------------------------------------------------
// Dusk sky styles (visual radio cards, exactly one selected,
// included in the base price).
// -----------------------------------------------------------
export type DuskStyleId =
  | "expert-decide"
  | "dramatic-clouds"
  | "warm-sun-glow"
  | "purple-pink-fantasy"
  | "orange-yellow"
  | "cool-blue";

/** Const tuple of dusk-style ids (for zod enums and exhaustive checks). */
export const DUSK_STYLE_ID_VALUES = [
  "expert-decide",
  "dramatic-clouds",
  "warm-sun-glow",
  "purple-pink-fantasy",
  "orange-yellow",
  "cool-blue",
] as const;

export interface DuskStyleConfig {
  id: DuskStyleId;
  label: string;
  /** Short supporting description shown under the label. */
  supportingText: string;
  /** Admin-managed service-options media key for this style's example. */
  mediaKey: string;
}

export const DUSK_STYLES: DuskStyleConfig[] = [
  {
    id: "expert-decide",
    label: "Let Our Experts Decide",
    supportingText: "We choose the most natural dusk sky for your photo",
    mediaKey: "day-to-dusk-style-expert-decide",
  },
  {
    id: "dramatic-clouds",
    label: "Dramatic Clouds",
    supportingText: "Dramatic clouds with intense detail",
    mediaKey: "day-to-dusk-style-dramatic-clouds",
  },
  {
    id: "warm-sun-glow",
    label: "Warm Sun Glow",
    supportingText: "Warm whites and yellows with a subtle sun glow",
    mediaKey: "day-to-dusk-style-warm-sun-glow",
  },
  {
    id: "purple-pink-fantasy",
    label: "Purple & Pink Fantasy",
    supportingText: "Purple, pink and blue fantasy twilight tones",
    mediaKey: "day-to-dusk-style-purple-pink-fantasy",
  },
  {
    id: "orange-yellow",
    label: "Orange & Yellow",
    supportingText: "Warm orange and yellow sunset tones",
    mediaKey: "day-to-dusk-style-orange-yellow",
  },
  {
    id: "cool-blue",
    label: "Cool Blue",
    supportingText: "Cooler blue-hour tones with subtle colour",
    mediaKey: "day-to-dusk-style-cool-blue",
  },
];

export const DUSK_STYLE_DEFAULT: DuskStyleId = "expert-decide";

export function isDuskStyleId(value: unknown): value is DuskStyleId {
  return (
    typeof value === "string" && DUSK_STYLES.some((s) => s.id === value)
  );
}

/** Server-side safe label derivation for a dusk-style id. */
export function getDuskStyleLabel(value: unknown): string {
  const match = DUSK_STYLES.find((s) => s.id === value);
  const fallback = DUSK_STYLES.find((s) => s.id === DUSK_STYLE_DEFAULT)!;
  return (match ?? fallback).label;
}

// -----------------------------------------------------------
// Lighting preferences (typed booleans, all included in the base
// price — they never change the subtotal). Sky transformation is
// already inherent to Day to Dusk, so it is NOT a preference here.
// -----------------------------------------------------------
export type DuskLightingKey =
  | "turn_on_interior_lights"
  | "turn_on_exterior_lights"
  | "add_pool_lights";

export type DuskLightingField =
  | "turnOnInteriorLights"
  | "turnOnExteriorLights"
  | "addPoolLights";

export interface DuskLightingPreferenceConfig {
  /** snake_case persistence key in order_items.details. */
  key: DuskLightingKey;
  /** camelCase key on the client item state / payload. */
  field: DuskLightingField;
  /** Human label shown in the form and in displays. */
  label: string;
  /** Default value (Interior/Exterior default Yes, Pool default No). */
  default: boolean;
}

export const DUSK_LIGHTING_PREFERENCES: DuskLightingPreferenceConfig[] = [
  {
    key: "turn_on_interior_lights",
    field: "turnOnInteriorLights",
    label: "Interior Lights",
    default: true,
  },
  {
    key: "turn_on_exterior_lights",
    field: "turnOnExteriorLights",
    label: "Exterior Lights",
    default: true,
  },
  {
    key: "add_pool_lights",
    field: "addPoolLights",
    label: "Add Pool Lights",
    default: false,
  },
];

/** All service-options media keys used by the Day to Dusk surfaces. */
export const DAY_TO_DUSK_MEDIA_KEYS: string[] = DUSK_STYLES.map(
  (s) => s.mediaKey
);
