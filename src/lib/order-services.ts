// ============================================================
// ORDER SERVICE REGISTRY — single source of truth for the
// authenticated New Order hub (/dashboard/orders/new).
//
// The hub renders entirely from this registry. Service metadata
// must live here, not scattered across the page.
//
// SCOPE: this registry only describes the catalog (titles, copy,
// price LABELS, routes, availability, card-image slug). It does
// NOT define prices — pricing remains in src/data/order-options.ts
// and the pricing calculators. The price strings below are display
// labels only and mirror the current public pricing..
// ============================================================

import {
  ImagePlus,
  Sunset,
  Sofa,
  Eraser,
  LayoutGrid,
  Paintbrush,
  Orbit,
  Compass,
  Plane,
  Map as MapIcon,
  type LucideIcon,
} from "lucide-react";
import {
  getOrderServiceCatalogEntry,
  type OrderServiceAvailability,
  type OrderServiceCanonicalFields,
  type OrderServiceSlug,
} from "@/lib/order-service-catalog";
import type { PortfolioServiceSlug } from "@/lib/portfolio";
import type { PriceKey } from "@/lib/pricing/types";

/**
 * Availability drives the card CTA treatment:
 *   - "active":       has a working order form → clickable "Start Order"
 *   - "coming-soon":  dedicated form not built yet → disabled "Coming Soon"
 *   - "custom-quote": quote-based service → disabled "Custom Quote"
 */

export type { OrderServiceAvailability };

export interface OrderServiceCard extends OrderServiceCanonicalFields {
  /** Short, scannable description (~2-3 lines max in the UI). */
  description: string;
  /** Display-only price/availability label. Not used for billing. */
  priceLabel: string;
  priceKey?: PriceKey;
  /**
   * Canonical portfolio service slug used to look up Before/After
   * gallery examples. null for the temporary Photo Editing umbrella
   * card (no canonical portfolio slug).
   */
  portfolioServiceSlug: PortfolioServiceSlug | null;
  /** Turnaround/availability sub-label, or null. */
  turnaroundLabel: string | null;
  /** Optional small badge shown over the image (e.g. "360°", "Quote"). */
  badge: string | null;
  /**
   * Service slug used to look up the admin-managed card image in
   * site-media (section "order-card"). null → CSS fallback only
   * (used by the temporary Photo Editing card so it needs no slot).
   */
  mediaServiceSlug: string | null;
  /** Fallback icon rendered when no card image is published. */
  icon: LucideIcon;
  /** True for the temporary legacy umbrella card (Photo Editing). */
  temporary?: boolean;
}

// 24-48h is the site-wide stated turnaround for digital edits
// (see Confirmation + public pricing). Reused as a label only.
const DIGITAL_TURNAROUND = "24-48 hours";

export const ORDER_SERVICE_CARDS: OrderServiceCard[] = [
  {
    ...canonicalService("image-enhancement"),
    description:
      "Professional color, exposure, white balance, and detail correction for listing photos.",
    portfolioServiceSlug: "image-enhancement",
    priceLabel: "Current catalog price",
    priceKey: "image-enhancement",
    turnaroundLabel: DIGITAL_TURNAROUND,
    badge: null,
    mediaServiceSlug: "image-enhancement",
    icon: ImagePlus,
  },
  {
    ...canonicalService("day-to-dusk"),
    description:
      "Convert daytime exterior shots into warm, twilight hero images with glowing windows.",
    portfolioServiceSlug: "day-to-dusk",
    priceLabel: "Current catalog price",
    priceKey: "day-to-dusk",
    turnaroundLabel: DIGITAL_TURNAROUND,
    badge: null,
    mediaServiceSlug: "day-to-dusk",
    icon: Sunset,
  },
  {
    ...canonicalService("virtual-staging"),
    description:
      "Furnish empty rooms with realistic furniture and decor across nine styles.",
    portfolioServiceSlug: "virtual-staging",
    priceLabel: "Current catalog price",
    priceKey: "virtual-staging",
    turnaroundLabel: DIGITAL_TURNAROUND,
    badge: null,
    mediaServiceSlug: "virtual-staging",
    icon: Sofa,
  },
  {
    ...canonicalService("item-removal-virtual-cleaning"),
    description:
      "Remove clutter, objects, and distractions for clean, listing-ready spaces.",
    portfolioServiceSlug: "item-removal-virtual-cleaning",
    priceLabel: "Current catalog price",
    priceKey: "item-removal-virtual-cleaning",
    turnaroundLabel: DIGITAL_TURNAROUND,
    badge: null,
    mediaServiceSlug: "item-removal-virtual-cleaning",
    icon: Eraser,
  },
  {
    ...canonicalService("floor-plans"),
    description:
      "Clean 2D and 3D floor plans from your sketches, scans, or existing plans.",
    portfolioServiceSlug: "floor-plans",
    priceLabel: "Current catalog price",
    priceKey: "floor-plan-2d-bw",
    turnaroundLabel: DIGITAL_TURNAROUND,
    badge: null,
    mediaServiceSlug: "floor-plans",
    icon: LayoutGrid,
  },
  {
    ...canonicalService("virtual-renovation"),
    description:
      "Digitally renovate kitchens, bathrooms, interiors, and exteriors with option-based pricing.",
    portfolioServiceSlug: "virtual-renovation",
    priceLabel: "Current catalog price",
    priceKey: "renovation-replace-walls",
    turnaroundLabel: DIGITAL_TURNAROUND,
    badge: null,
    mediaServiceSlug: "virtual-renovation",
    icon: Paintbrush,
  },
  {
    ...canonicalService("360-image-enhancement"),
    description:
      "Correct, balance, and polish equirectangular panoramas for professional virtual tours.",
    portfolioServiceSlug: "360-image-enhancement",
    priceLabel: "Coming Soon",
    turnaroundLabel: null,
    badge: "360\u00b0",
    mediaServiceSlug: "360-image-enhancement",
    icon: Orbit,
  },
  {
    ...canonicalService("360-virtual-staging"),
    description:
      "Furnish 360\u00b0 panoramas for immersive, staged virtual tour experiences.",
    portfolioServiceSlug: "360-virtual-staging",
    priceLabel: "Coming Soon",
    turnaroundLabel: null,
    badge: "360\u00b0",
    mediaServiceSlug: "360-virtual-staging",
    icon: Compass,
  },
  {
    ...canonicalService("aerial-editing"),
    description:
      "Enhance drone and aerial imagery with labels, boundaries, and clean-ups. Custom quote.",
    portfolioServiceSlug: "aerial-editing",
    priceLabel: "Custom Quote",
    turnaroundLabel: null,
    badge: "Quote",
    mediaServiceSlug: "aerial-editing",
    icon: Plane,
  },
  {
    ...canonicalService("development-site-plans"),
    description:
      "Visual site plans for land, development, and multi-unit projects. Custom quote.",
    portfolioServiceSlug: "development-site-plans",
    priceLabel: "Custom Quote",
    turnaroundLabel: null,
    badge: "Quote",
    mediaServiceSlug: "development-site-plans",
    icon: MapIcon,
  },
];

/** Registry sorted for rendering. */
export function getOrderServiceCards(): OrderServiceCard[] {
  return [...ORDER_SERVICE_CARDS].sort((a, b) => a.sortOrder - b.sortOrder);
}

function canonicalService(slug: OrderServiceSlug): OrderServiceCanonicalFields {
  const service = getOrderServiceCatalogEntry(slug);
  if (!service) {
    throw new Error(`Missing order service catalog entry: ${slug}`);
  }

  return service;
}
