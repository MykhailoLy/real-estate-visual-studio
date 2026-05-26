// ============================================================
// TWO-LEVEL NAVIGATION CONFIG
//
// Single source of truth used by both the Header (top + second
// row) and any landing-style pages that need to render the same
// sub-nav links inline. Keeping this in lib/ rather than in the
// Header component avoids duplicating the lists when /local,
// /renders, and /online-retail want to surface their own service
// links inside the page body.
// ============================================================

export type TopLevelKey =
  | "remote"
  | "local"
  | "renders"
  | "online-retail";

export interface SubNavLink {
  /**
   * URL or `#anchor`. Anchors scroll to the matching card on the
   * current top-level page; full URLs (e.g. /pricing/...) navigate.
   */
  href: string;
  label: string;
  /** Set when the destination is on a *different* page than the
   *  current top-level so the Header can render an inline icon.
   *  Currently unused — kept here for future expansion. */
  external?: boolean;
}

export interface TopLevelEntry {
  key: TopLevelKey;
  /** Top-level page route. */
  href: string;
  label: string;
  /** Short copy shown on the corresponding landing page hero. */
  tagline: string;
  /** Sub-nav rendered as the second row of the header on this
   *  top-level page. */
  subLinks: SubNavLink[];
}

/**
 * Top-level categories shown in the header's first row.
 * Order is significant: it drives the rendered tab order.
 */
export const topLevels: TopLevelEntry[] = [
  {
    key: "remote",
    href: "/",
    label: "Remote Digital Services",
    tagline:
      "Edits delivered worldwide in 24-48 hours. Upload your photos and choose what you need.",
    subLinks: [
      { href: "#image-enhancement", label: "Image Enhancement" },
      { href: "#day-to-dusk", label: "Day to Dusk" },
      { href: "#virtual-staging", label: "Virtual Staging" },
      { href: "#item-removal", label: "Item Removal & Virtual Cleaning" },
      { href: "#floor-plans", label: "Floor Plans" },
      { href: "#virtual-renovation", label: "Virtual Renovation" },
      { href: "#360-image-enhancement", label: "360° Image Enhancement" },
      { href: "#360-virtual-staging", label: "360° Virtual Staging" },
      { href: "#aerial-editing", label: "Aerial Editing" },
      { href: "#development-site-plans", label: "Development Site Plans" },
    ],
  },
  {
    key: "local",
    href: "/local",
    label: "Local Real Estate Media",
    tagline:
      "On-location photography, video, and tours across Alicante and Costa Blanca.",
    subLinks: [
      { href: "#real-estate-photography", label: "Real Estate Photography" },
      { href: "#360-virtual-tours", label: "360 Virtual Tours" },
      { href: "#property-video-tours", label: "Property Video Tours" },
      { href: "#drone-aerial-media", label: "Drone / Aerial Media" },
      { href: "#full-listing-packages", label: "Full Listing Media Packages" },
    ],
  },
  {
    key: "renders",
    href: "/renders",
    label: "Renders",
    tagline:
      "Architectural visualization for projects that don't exist yet — or that you want to imagine differently.",
    subLinks: [
      { href: "#exterior-renders", label: "Exterior Renders" },
      { href: "#interior-renders", label: "Interior Renders" },
      { href: "#360-renders", label: "360° Renders" },
      { href: "#360-virtual-tours-renders", label: "360° Virtual Tours" },
      { href: "#development-marketing", label: "Development Marketing" },
    ],
  },
  {
    key: "online-retail",
    href: "/online-retail",
    label: "Online Retail",
    tagline:
      "Clean, consistent product visuals for storefronts and marketplaces.",
    subLinks: [
      { href: "#product-photo-editing", label: "Product Photo Editing" },
      { href: "#background-removal", label: "Background Removal" },
      { href: "#lifestyle-compositing", label: "Lifestyle Compositing" },
      { href: "#color-variations", label: "Color Variations" },
      { href: "#marketplace-images", label: "Marketplace Images" },
    ],
  },
];

/** Quick lookup by top-level pathname. */
export function getTopLevelForPath(pathname: string): TopLevelEntry {
  // Normalize to the leading-segment so /pricing, /order, etc still
  // resolve to "remote" (the default) and don't break the sub-nav.
  if (pathname === "/" || pathname === "") return topLevels[0];
  for (const entry of topLevels) {
    if (entry.href === "/") continue; // skip default; handled above
    if (pathname === entry.href || pathname.startsWith(entry.href + "/")) {
      return entry;
    }
  }
  return topLevels[0];
}

/** Right-side CTAs in the header's first row. */
export const headerCtaLinks = [
  { href: "/order", label: "Order" },
  { href: "/contact", label: "Contact" },
] as const;
