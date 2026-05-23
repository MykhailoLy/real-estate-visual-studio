// ============================================================
// VIRTUAL STAGING — STYLE GALLERY DATA
// ============================================================
// Drives the "Style Options" gallery on /pricing/virtual-staging only.
// Independent from STAGING_STYLE_OPTIONS (used by the order form), so
// the order form's Furniture Style dropdown and visual selector stay
// untouched.
//
// Each style declares 3 placeholder image paths under /public/images/styles/.
// Real images can be dropped into that folder later named:
//   <slug>-1.jpg  <slug>-2.jpg  <slug>-3.jpg
// If a file is missing, the UI silently falls back to a clean named
// placeholder block — same convention used by the order-form
// StyleSelector.

export interface StyleGalleryImage {
  /** Source path under /public. */
  src: string;
  /** Accessible alt text. */
  alt: string;
}

export interface StyleGalleryEntry {
  /** Stable slug used for keys, image filenames, and analytics. */
  id: string;
  /** Visible card title. Matches the marketing list (9 styles). */
  label: string;
  /** Optional short tagline shown under the title. */
  description?: string;
  /** Ordered list of preview images. The first one is the cover. */
  images: StyleGalleryImage[];
}

const galleryImages = (slug: string, label: string): StyleGalleryImage[] => [
  { src: `/images/styles/${slug}-1.jpg`, alt: `${label} interior staging — example 1` },
  { src: `/images/styles/${slug}-2.jpg`, alt: `${label} interior staging — example 2` },
  { src: `/images/styles/${slug}-3.jpg`, alt: `${label} interior staging — example 3` },
];

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
    images: galleryImages("modern", "Modern"),
  },
  {
    id: "urban",
    label: "Urban",
    description: "Industrial textures, dark accents, raw materials.",
    images: galleryImages("urban-industrial", "Urban / Industrial"),
  },
  {
    id: "scandinavian",
    label: "Scandinavian",
    description: "Soft Nordic light, pale woods, minimal warmth.",
    images: galleryImages("scandinavian", "Scandinavian"),
  },
  {
    id: "mid-century",
    label: "Mid-Century",
    description: "Walnut tones, sculpted silhouettes, retro confidence.",
    images: galleryImages("mid-century-modern", "Mid-Century Modern"),
  },
  {
    id: "farmhouse",
    label: "Farmhouse",
    description: "Warm whites, natural textures, lived-in comfort.",
    images: galleryImages("farmhouse", "Farmhouse"),
  },
  {
    id: "hamptons",
    label: "Hamptons",
    description: "Coastal calm, cream and navy, refined linens.",
    images: galleryImages("hamptons", "Hamptons"),
  },
  {
    id: "contemporary",
    label: "Contemporary",
    description: "On-trend mix of modern silhouettes and curated decor.",
    images: galleryImages("contemporary", "Contemporary"),
  },
  {
    id: "traditional",
    label: "Traditional",
    description: "Classic furniture, layered textures, timeless feel.",
    images: galleryImages("traditional", "Traditional"),
  },
  {
    id: "commercial",
    label: "Commercial",
    description: "Offices, retail, hospitality, and shared spaces.",
    images: galleryImages("commercial", "Commercial"),
  },
];
