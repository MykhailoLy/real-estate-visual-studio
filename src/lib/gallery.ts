// ============================================================
// GALLERY — static copy and metadata helpers
//
// Single source of truth for:
//   - short card descriptions on the gallery landing page (EN + ES)
//   - service intro paragraphs on gallery detail pages (EN + ES)
//   - Spanish display labels for each portfolio service slug
//
// Intentionally free of runtime logic — pure data that can be
// tree-shaken if a page only imports part of it.
// ============================================================

import type { PortfolioServiceSlug } from "@/lib/portfolio";

// ── Landing-page category card descriptions ──────────────────

/** One-sentence teaser shown on the gallery category card (EN). */
export const GALLERY_CARD_DESCRIPTIONS: Record<PortfolioServiceSlug, string> =
  {
    "virtual-staging":
      "See empty rooms transformed into realistic, market-ready interiors.",
    "virtual-renovation":
      "Explore realistic finish, layout, kitchen, bathroom, and exterior renovation concepts.",
    "image-enhancement":
      "View listing photos improved through balanced color, exposure, windows, and detail.",
    "item-removal-virtual-cleaning":
      "See cluttered rooms transformed into clean, listing-ready spaces.",
    "day-to-dusk":
      "Explore daytime exterior images converted into warm twilight presentation.",
    "floor-plans":
      "View sketches and scans converted into clean 2D and 3D listing floor plans.",
    "360-image-enhancement":
      "See panoramic images polished for professional virtual tour presentation.",
    "360-virtual-staging":
      "Explore furnished virtual tour panoramas ready for immersive listing experiences.",
    "aerial-editing":
      "View drone and aerial property images enhanced for land, exterior, and listing use.",
    "development-site-plans":
      "Explore visual site plans prepared for land, development, and multi-unit projects.",
  };

/** One-sentence teaser shown on the gallery category card (ES). */
export const GALLERY_CARD_DESCRIPTIONS_ES: Record<
  PortfolioServiceSlug,
  string
> = {
  "virtual-staging":
    "Descubre habitaciones vacías transformadas en interiores realistas y listos para el mercado.",
  "virtual-renovation":
    "Explora conceptos realistas de renovación de acabados, distribución, cocinas, baños y exteriores.",
  "image-enhancement":
    "Ve fotos de anuncios mejoradas con color, exposición, ventanas y detalle equilibrados.",
  "item-removal-virtual-cleaning":
    "Comprueba cómo habitaciones desordenadas se convierten en espacios limpios y listos para publicar.",
  "day-to-dusk":
    "Explora imágenes exteriores diurnas convertidas en escenas cálidas al atardecer.",
  "floor-plans":
    "Ve bocetos y escaneos convertidos en planos 2D y 3D limpios para anuncios.",
  "360-image-enhancement":
    "Ve panoramas corregidos, equilibrados y pulidos para tours virtuales profesionales.",
  "360-virtual-staging":
    "Explora panoramas 360° amueblados listos para tours virtuales inmobiliarios.",
  "aerial-editing":
    "Ve imágenes de dron y aéreas mejoradas para una presentación más clara de propiedades y terrenos.",
  "development-site-plans":
    "Explora planos visuales de emplazamiento para terrenos, promociones y proyectos multiunidad.",
};

// ── Service detail page intro paragraphs ─────────────────────

/** Short intro paragraph at the top of a gallery detail page (EN). */
export const GALLERY_SERVICE_INTROS: Record<PortfolioServiceSlug, string> = {
  "virtual-staging":
    "Browse before-and-after examples of empty and outdated rooms staged with realistic furniture and decor.",
  "virtual-renovation":
    "See renovation concepts across interiors, exteriors, kitchens, bathrooms, and outdoor spaces.",
  "image-enhancement":
    "Explore listing photos improved through color correction, exposure balancing, and window view recovery.",
  "item-removal-virtual-cleaning":
    "See the difference clear, clutter-free spaces make to listing presentation.",
  "day-to-dusk":
    "Browse daytime exterior photos converted into warm twilight shots for stronger listing hero images.",
  "floor-plans":
    "Explore sketches and scans transformed into clean, listing-ready 2D and 3D floor plans.",
  "360-image-enhancement":
    "See panoramic images corrected, balanced, and polished for professional virtual tour use.",
  "360-virtual-staging":
    "Browse furnished 360° panoramas ready for immersive virtual tour listings.",
  "aerial-editing":
    "Explore drone and aerial images enhanced for clearer property and land presentation.",
  "development-site-plans":
    "See project sketches transformed into clear visual site plans for land and development presentation.",
};

/** Short intro paragraph at the top of a gallery detail page (ES). */
export const GALLERY_SERVICE_INTROS_ES: Record<PortfolioServiceSlug, string> =
  {
    "virtual-staging":
      "Explora ejemplos antes y después de habitaciones vacías y anticuadas amuebladas con mobiliario y decoración realistas.",
    "virtual-renovation":
      "Ve conceptos de renovación en interiores, exteriores, cocinas, baños y espacios al aire libre.",
    "image-enhancement":
      "Descubre fotos de anuncios mejoradas con corrección de color, equilibrio de exposición y recuperación de vistas por ventana.",
    "item-removal-virtual-cleaning":
      "Comprueba la diferencia que suponen los espacios limpios y sin distracciones en los anuncios.",
    "day-to-dusk":
      "Explora fotos exteriores diurnas convertidas en tomas cálidas al atardecer para hero shots más potentes.",
    "floor-plans":
      "Explora bocetos y escaneos transformados en planos 2D y 3D limpios y listos para anuncios.",
    "360-image-enhancement":
      "Ve panoramas corregidos, equilibrados y pulidos para tours virtuales profesionales.",
    "360-virtual-staging":
      "Explora panoramas 360° amueblados para tours virtuales inmobiliarios inmersivos.",
    "aerial-editing":
      "Ve imágenes de dron y aéreas mejoradas para una presentación más clara de propiedades y terrenos.",
    "development-site-plans":
      "Ve bocetos de proyecto transformados en planos de emplazamiento visuales claros para terrenos y promociones.",
  };

// ── Spanish display labels ────────────────────────────────────

/**
 * Spanish display names for each portfolio service. Mirrors the
 * existing Spanish site convention: service names that are
 * established as English terms in the Spanish market (e.g.
 * "Virtual Staging", "Day to Dusk") remain in English.
 */
export const GALLERY_LABELS_ES: Record<PortfolioServiceSlug, string> = {
  "virtual-staging": "Virtual Staging",
  "virtual-renovation": "Renovación virtual",
  "image-enhancement": "Mejora de imagen",
  "item-removal-virtual-cleaning": "Eliminación de objetos y limpieza virtual",
  "day-to-dusk": "Day to Dusk",
  "floor-plans": "Planos",
  "360-image-enhancement": "Mejora de imagen 360°",
  "360-virtual-staging": "Virtual Staging 360°",
  "aerial-editing": "Edición aérea",
  "development-site-plans": "Planos de emplazamiento",
};

// ── SEO meta description builders ────────────────────────────

export function galleryServiceMetaDescription(label: string): string {
  return `Browse PicchuSpot before-and-after ${label.toLowerCase()} examples for real estate listings.`;
}

export function galleryServiceMetaDescriptionEs(labelEs: string): string {
  return `Explora ejemplos antes y después de ${labelEs.toLowerCase()} de PicchuSpot para anuncios inmobiliarios.`;
}

export type GalleryLanguage = "en" | "es";

// ============================================================
// BEFORE / RESULT LABEL BARS
// ============================================================
//
// Each gallery example shows a dark label bar under the left
// (before) and right (result) image. The result label is
// service-specific. Durations are only used where they reflect
// turnaround already stated in visible site content (24–48h for
// digital edits). Quote-based services that don't advertise a
// fixed turnaround use the neutral AFTER / DESPUÉS label.

export interface GalleryPairLabels {
  beforeEn: string;
  afterEn: string;
  beforeEs: string;
  afterEs: string;
}

const NEUTRAL_LABELS: GalleryPairLabels = {
  beforeEn: "BEFORE",
  afterEn: "AFTER",
  beforeEs: "ANTES",
  afterEs: "DESPUÉS",
};

export const GALLERY_PAIR_LABELS: Record<
  PortfolioServiceSlug,
  GalleryPairLabels
> = {
  "virtual-staging": {
    beforeEn: "BEFORE",
    afterEn: "24–48 HOURS LATER",
    beforeEs: "ANTES",
    afterEs: "24–48 HORAS DESPUÉS",
  },
  "virtual-renovation": {
    beforeEn: "BEFORE",
    afterEn: "48 HOURS LATER",
    beforeEs: "ANTES",
    afterEs: "48 HORAS DESPUÉS",
  },
  "image-enhancement": {
    beforeEn: "BEFORE",
    afterEn: "24 HOURS LATER",
    beforeEs: "ANTES",
    afterEs: "24 HORAS DESPUÉS",
  },
  "item-removal-virtual-cleaning": {
    beforeEn: "BEFORE",
    afterEn: "24 HOURS LATER",
    beforeEs: "ANTES",
    afterEs: "24 HORAS DESPUÉS",
  },
  "day-to-dusk": {
    beforeEn: "BEFORE",
    afterEn: "24 HOURS LATER",
    beforeEs: "ANTES",
    afterEs: "24 HORAS DESPUÉS",
  },
  "floor-plans": {
    beforeEn: "SOURCE",
    afterEn: "FINAL PLAN",
    beforeEs: "ORIGINAL",
    afterEs: "PLANO FINAL",
  },
  // Quote-based services without a fixed advertised turnaround.
  "360-image-enhancement": NEUTRAL_LABELS,
  "360-virtual-staging": NEUTRAL_LABELS,
  "aerial-editing": NEUTRAL_LABELS,
  "development-site-plans": NEUTRAL_LABELS,
};

/** Resolve the before/result label pair for a service + language. */
export function getGalleryPairLabels(
  slug: PortfolioServiceSlug,
  lang: GalleryLanguage,
): { before: string; after: string } {
  const labels = GALLERY_PAIR_LABELS[slug] ?? NEUTRAL_LABELS;
  return lang === "es"
    ? { before: labels.beforeEs, after: labels.afterEs }
    : { before: labels.beforeEn, after: labels.afterEn };
}

// ============================================================
// PORTFOLIO GALLERY FILTERS
// ============================================================
//
// A single nullable `gallery_filter` column on portfolio_items
// stores one of the values below. Only a subset of services have
// configured filters; everything else keeps gallery_filter = null
// and shows no filter UI.
//
// Stored values are stable internal identifiers. Display labels
// are localized separately so we never persist a translated
// string. Spanish keeps established English interior style names
// where the marketing site already does.

export interface GalleryFilterOption {
  /** Stable value stored in portfolio_items.gallery_filter. */
  value: string;
  labelEn: string;
  labelEs: string;
}

/** Admin field label per service (shown above the admin dropdown). */
export interface GalleryFilterFieldLabel {
  en: string;
  es: string;
}

const VIRTUAL_STAGING_FILTERS: GalleryFilterOption[] = [
  { value: "modern", labelEn: "Modern", labelEs: "Modern" },
  { value: "contemporary", labelEn: "Contemporary", labelEs: "Contemporary" },
  { value: "scandinavian", labelEn: "Scandinavian", labelEs: "Scandinavian" },
  {
    value: "mid-century-modern",
    labelEn: "Mid-Century Modern",
    labelEs: "Mid-Century Modern",
  },
  { value: "farmhouse", labelEn: "Farmhouse", labelEs: "Farmhouse" },
  { value: "hamptons", labelEn: "Hamptons", labelEs: "Hamptons" },
  { value: "traditional", labelEn: "Traditional", labelEs: "Traditional" },
  {
    value: "urban-industrial",
    labelEn: "Urban / Industrial",
    labelEs: "Urban / Industrial",
  },
  {
    value: "commercial-office",
    labelEn: "Commercial — Office",
    labelEs: "Comercial — Oficina",
  },
  {
    value: "commercial-non-office",
    labelEn: "Commercial — Non-office",
    labelEs: "Comercial — No oficina",
  },
];

const VIRTUAL_RENOVATION_FILTERS: GalleryFilterOption[] = [
  { value: "interior", labelEn: "Interior", labelEs: "Interior" },
  { value: "exterior", labelEn: "Exterior", labelEs: "Exterior" },
  { value: "commercial", labelEn: "Commercial", labelEs: "Comercial" },
];

const FLOOR_PLANS_FILTERS: GalleryFilterOption[] = [
  {
    value: "2d-black-white",
    labelEn: "2D Black & White",
    labelEs: "2D Blanco y negro",
  },
  { value: "2d-color", labelEn: "2D Color", labelEs: "2D Color" },
  { value: "3d", labelEn: "3D", labelEs: "3D" },
  { value: "3d-premium", labelEn: "3D Premium", labelEs: "3D Premium" },
];

/**
 * Services with a configured gallery filter. Services NOT present
 * here must keep gallery_filter = null and show no filter UI.
 */
export const GALLERY_FILTERS: Partial<
  Record<PortfolioServiceSlug, GalleryFilterOption[]>
> = {
  "virtual-staging": VIRTUAL_STAGING_FILTERS,
  "virtual-renovation": VIRTUAL_RENOVATION_FILTERS,
  "floor-plans": FLOOR_PLANS_FILTERS,
};

/** Admin field label per filtered service. */
export const GALLERY_FILTER_FIELD_LABELS: Partial<
  Record<PortfolioServiceSlug, GalleryFilterFieldLabel>
> = {
  "virtual-staging": { en: "Gallery style", es: "Estilo de galería" },
  "virtual-renovation": {
    en: "Gallery category",
    es: "Categoría de galería",
  },
  "floor-plans": { en: "Floor plan type", es: "Tipo de plano" },
};

/** The "All" / "Todos" option label, used in the public filter select. */
export const GALLERY_FILTER_ALL_LABEL = { en: "All", es: "Todos" } as const;

/** Returns the configured filter options for a service, or null. */
export function getGalleryFilterOptions(
  slug: PortfolioServiceSlug,
): GalleryFilterOption[] | null {
  return GALLERY_FILTERS[slug] ?? null;
}

/** Whether a service supports gallery filtering at all. */
export function serviceHasGalleryFilter(slug: PortfolioServiceSlug): boolean {
  return Boolean(GALLERY_FILTERS[slug]);
}

/**
 * Server-side validation: is `value` a valid gallery_filter for
 * the given service? `null`/empty is always valid (means "unset").
 * Services without a configured filter must always store null.
 */
export function isValidGalleryFilterValue(
  slug: PortfolioServiceSlug,
  value: string | null | undefined,
): boolean {
  if (value == null || value === "") return true;
  const options = GALLERY_FILTERS[slug];
  if (!options) return false; // service has no filter → only null allowed
  return options.some((o) => o.value === value);
}

/**
 * Normalize an incoming gallery_filter for a service:
 *   - returns the value if valid for the service
 *   - returns null for unset/empty or for services without filters
 *   - returns null (drop) if the value is not in the service's set
 */
export function normalizeGalleryFilter(
  slug: PortfolioServiceSlug,
  value: string | null | undefined,
): string | null {
  if (value == null || value === "") return null;
  const options = GALLERY_FILTERS[slug];
  if (!options) return null;
  return options.some((o) => o.value === value) ? value : null;
}

/** Localized display label for a stored filter value (fallback: value). */
export function getGalleryFilterLabel(
  slug: PortfolioServiceSlug,
  value: string,
  lang: GalleryLanguage,
): string {
  const options = GALLERY_FILTERS[slug];
  const match = options?.find((o) => o.value === value);
  if (!match) return value;
  return lang === "es" ? match.labelEs : match.labelEn;
}
