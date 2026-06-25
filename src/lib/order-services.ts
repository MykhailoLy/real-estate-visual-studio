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
import type { PortfolioServiceSlug } from "@/lib/portfolio";
import type { PriceKey } from "@/lib/pricing/types";

/**
 * Availability drives the card CTA treatment:
 *   - "active":       has a working order form → clickable "Start Order"
 *   - "coming-soon":  dedicated form not built yet → disabled "Coming Soon"
 *   - "custom-quote": quote-based service → disabled "Custom Quote"
 */
export type OrderServiceAvailability = "active" | "coming-soon" | "custom-quote";

export interface OrderServiceCard {
  /** Stable catalog key (also the React list key). */
  slug: string;
  title: string;
  /** Short, scannable description (~2-3 lines max in the UI). */
  description: string;
  /**
   * Protected dashboard route for active services; null when the
   * service has no dedicated form yet (inactive cards never navigate).
   */
  route: string | null;
  /** Canonical public service slug (matches pricing/portfolio slugs). */
  publicServiceSlug: string;
  availability: OrderServiceAvailability;
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
  sortOrder: number;
}

// 24-48h is the site-wide stated turnaround for digital edits
// (see Confirmation + public pricing). Reused as a label only.
const DIGITAL_TURNAROUND = "24-48 hours";

export const ORDER_SERVICE_CARDS: OrderServiceCard[] = [
  {
    slug: "image-enhancement",
    title: "Image Enhancement",
    description:
      "Professional color, exposure, white balance, and detail correction for listing photos.",
    route: "/dashboard/orders/new/image-enhancement",
    publicServiceSlug: "image-enhancement",
    availability: "active",
    portfolioServiceSlug: "image-enhancement",
    priceLabel: "Current catalog price",
    priceKey: "image-enhancement",
    turnaroundLabel: DIGITAL_TURNAROUND,
    badge: null,
    mediaServiceSlug: "image-enhancement",
    icon: ImagePlus,
    sortOrder: 1,
  },
  {
    slug: "day-to-dusk",
    title: "Day to Dusk",
    description:
      "Convert daytime exterior shots into warm, twilight hero images with glowing windows.",
    route: "/dashboard/orders/new/day-to-dusk",
    publicServiceSlug: "day-to-dusk",
    availability: "active",
    portfolioServiceSlug: "day-to-dusk",
    priceLabel: "Current catalog price",
    priceKey: "day-to-dusk",
    turnaroundLabel: DIGITAL_TURNAROUND,
    badge: null,
    mediaServiceSlug: "day-to-dusk",
    icon: Sunset,
    sortOrder: 2,
  },
  {
    slug: "virtual-staging",
    title: "Virtual Staging",
    description:
      "Furnish empty rooms with realistic furniture and decor across nine styles.",
    route: "/dashboard/orders/new/virtual-staging",
    publicServiceSlug: "virtual-staging",
    availability: "active",
    portfolioServiceSlug: "virtual-staging",
    priceLabel: "Current catalog price",
    priceKey: "virtual-staging",
    turnaroundLabel: DIGITAL_TURNAROUND,
    badge: null,
    mediaServiceSlug: "virtual-staging",
    icon: Sofa,
    sortOrder: 3,
  },
  {
    slug: "item-removal-virtual-cleaning",
    title: "Item Removal & Virtual Cleaning",
    description:
      "Remove clutter, objects, and distractions for clean, listing-ready spaces.",
    route: "/dashboard/orders/new/item-removal-virtual-cleaning",
    publicServiceSlug: "item-removal-virtual-cleaning",
    availability: "active",
    portfolioServiceSlug: "item-removal-virtual-cleaning",
    priceLabel: "Current catalog price",
    priceKey: "item-removal-virtual-cleaning",
    turnaroundLabel: DIGITAL_TURNAROUND,
    badge: null,
    mediaServiceSlug: "item-removal-virtual-cleaning",
    icon: Eraser,
    sortOrder: 4,
  },
  {
    slug: "floor-plans",
    title: "Floor Plans",
    description:
      "Clean 2D and 3D floor plans from your sketches, scans, or existing plans.",
    route: "/dashboard/orders/new/3d-floor-plans",
    publicServiceSlug: "floor-plans",
    availability: "active",
    portfolioServiceSlug: "floor-plans",
    priceLabel: "Current catalog price",
    priceKey: "floor-plan-2d-bw",
    turnaroundLabel: DIGITAL_TURNAROUND,
    badge: null,
    mediaServiceSlug: "floor-plans",
    icon: LayoutGrid,
    sortOrder: 5,
  },
  {
    slug: "virtual-renovation",
    title: "Virtual Renovation",
    description:
      "Digitally renovate kitchens, bathrooms, interiors, and exteriors with option-based pricing.",
    route: "/dashboard/orders/new/virtual-renovation",
    publicServiceSlug: "virtual-renovation",
    availability: "active",
    portfolioServiceSlug: "virtual-renovation",
    priceLabel: "Current catalog price",
    priceKey: "renovation-replace-walls",
    turnaroundLabel: DIGITAL_TURNAROUND,
    badge: null,
    mediaServiceSlug: "virtual-renovation",
    icon: Paintbrush,
    sortOrder: 6,
  },
  {
    slug: "360-image-enhancement",
    title: "360\u00b0 Image Enhancement",
    description:
      "Correct, balance, and polish equirectangular panoramas for professional virtual tours.",
    route: null,
    publicServiceSlug: "360-image-enhancement",
    availability: "coming-soon",
    portfolioServiceSlug: "360-image-enhancement",
    priceLabel: "Coming Soon",
    turnaroundLabel: null,
    badge: "360\u00b0",
    mediaServiceSlug: "360-image-enhancement",
    icon: Orbit,
    sortOrder: 7,
  },
  {
    slug: "360-virtual-staging",
    title: "360\u00b0 Virtual Staging",
    description:
      "Furnish 360\u00b0 panoramas for immersive, staged virtual tour experiences.",
    route: null,
    publicServiceSlug: "360-virtual-staging",
    availability: "coming-soon",
    portfolioServiceSlug: "360-virtual-staging",
    priceLabel: "Coming Soon",
    turnaroundLabel: null,
    badge: "360\u00b0",
    mediaServiceSlug: "360-virtual-staging",
    icon: Compass,
    sortOrder: 8,
  },
  {
    slug: "aerial-editing",
    title: "Aerial Editing",
    description:
      "Enhance drone and aerial imagery with labels, boundaries, and clean-ups. Custom quote.",
    route: null,
    publicServiceSlug: "aerial-editing",
    availability: "custom-quote",
    portfolioServiceSlug: "aerial-editing",
    priceLabel: "Custom Quote",
    turnaroundLabel: null,
    badge: "Quote",
    mediaServiceSlug: "aerial-editing",
    icon: Plane,
    sortOrder: 9,
  },
  {
    slug: "development-site-plans",
    title: "Development Site Plans",
    description:
      "Visual site plans for land, development, and multi-unit projects. Custom quote.",
    route: null,
    publicServiceSlug: "development-site-plans",
    availability: "custom-quote",
    portfolioServiceSlug: "development-site-plans",
    priceLabel: "Custom Quote",
    turnaroundLabel: null,
    badge: "Quote",
    mediaServiceSlug: "development-site-plans",
    icon: MapIcon,
    sortOrder: 10,
  },
];

/** Registry sorted for rendering. */
export function getOrderServiceCards(): OrderServiceCard[] {
  return [...ORDER_SERVICE_CARDS].sort((a, b) => a.sortOrder - b.sortOrder);
}
