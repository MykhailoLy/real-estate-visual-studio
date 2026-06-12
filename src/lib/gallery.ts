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
