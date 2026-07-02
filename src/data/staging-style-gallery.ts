// ============================================================
// VIRTUAL STAGING — STYLE GALLERY DATA
// ============================================================
// Drives the "Style Options" gallery on /pricing/virtual-staging only.
// Independent from STAGING_STYLE_OPTIONS (used by the order form), so
// the order form's Furniture Style dropdown and visual selector stay
// untouched.
//
// Each style is visualized only when service-options media supplies real
// uploaded images. Without uploads, the UI shows its CSS placeholder.

export interface StyleGalleryEntry {
  /** Stable slug used for keys and analytics. */
  id: string;
  /** Visible card title. Matches the marketing list (9 styles). */
  label: string;
  /** Optional short tagline shown under the title. */
  description?: string;
}

/**
 * Marketing-facing list of 9 styles shown on the pricing page.
 * Note: the order form (`STAGING_STYLE_OPTIONS`) splits "Commercial"
 * into "Commercial Office" and "Commercial Non-Office" because the
 * order form needs that operational detail. The pricing page keeps a
 * single "Commercial" entry so it stays scannable for marketing.
 */
export const STAGING_STYLE_GALLERY: StyleGalleryEntry[] = [
  {
    id: "modern",
    label: "Modern",
    description: "Clean lines, neutral palettes, light woods.",
  },
  {
    id: "urban",
    label: "Urban",
    description: "Industrial textures, dark accents, raw materials.",
  },
  {
    id: "scandinavian",
    label: "Scandinavian",
    description: "Soft Nordic light, pale woods, minimal warmth.",
  },
  {
    id: "mid-century",
    label: "Mid-Century",
    description: "Walnut tones, sculpted silhouettes, retro confidence.",
  },
  {
    id: "farmhouse",
    label: "Farmhouse",
    description: "Warm whites, natural textures, lived-in comfort.",
  },
  {
    id: "hamptons",
    label: "Hamptons",
    description: "Coastal calm, cream and navy, refined linens.",
  },
  {
    id: "contemporary",
    label: "Contemporary",
    description: "On-trend mix of modern silhouettes and curated decor.",
  },
  {
    id: "traditional",
    label: "Traditional",
    description: "Classic furniture, layered textures, timeless feel.",
  },
  {
    id: "commercial",
    label: "Commercial",
    description: "Offices, retail, hospitality, and shared spaces.",
  },
];
