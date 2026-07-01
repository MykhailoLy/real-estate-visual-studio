export type OrderServiceAvailability = "active" | "coming-soon" | "custom-quote";

export interface OrderServiceCanonicalFields {
  /** Stable catalog key (also the React list key). */
  slug: string;
  title: string;
  /**
   * Protected dashboard route for active services; null when the
   * service has no dedicated form yet (inactive cards never navigate).
   */
  route: string | null;
  /** Canonical public service slug (matches pricing/portfolio slugs). */
  publicServiceSlug: string;
  availability: OrderServiceAvailability;
  sortOrder: number;
}

export const ORDER_SERVICE_CATALOG = [
  {
    slug: "image-enhancement",
    title: "Image Enhancement",
    route: "/dashboard/orders/new/image-enhancement",
    publicServiceSlug: "image-enhancement",
    availability: "active",
    sortOrder: 1,
  },
  {
    slug: "day-to-dusk",
    title: "Day to Dusk",
    route: "/dashboard/orders/new/day-to-dusk",
    publicServiceSlug: "day-to-dusk",
    availability: "active",
    sortOrder: 2,
  },
  {
    slug: "virtual-staging",
    title: "Virtual Staging",
    route: "/dashboard/orders/new/virtual-staging",
    publicServiceSlug: "virtual-staging",
    availability: "active",
    sortOrder: 3,
  },
  {
    slug: "item-removal-virtual-cleaning",
    title: "Item Removal & Virtual Cleaning",
    route: "/dashboard/orders/new/item-removal-virtual-cleaning",
    publicServiceSlug: "item-removal-virtual-cleaning",
    availability: "active",
    sortOrder: 4,
  },
  {
    slug: "floor-plans",
    title: "Floor Plans",
    route: "/dashboard/orders/new/3d-floor-plans",
    publicServiceSlug: "floor-plans",
    availability: "active",
    sortOrder: 5,
  },
  {
    slug: "virtual-renovation",
    title: "Virtual Renovation",
    route: "/dashboard/orders/new/virtual-renovation",
    publicServiceSlug: "virtual-renovation",
    availability: "active",
    sortOrder: 6,
  },
  {
    slug: "360-image-enhancement",
    title: "360\u00b0 Image Enhancement",
    route: null,
    publicServiceSlug: "360-image-enhancement",
    availability: "coming-soon",
    sortOrder: 7,
  },
  {
    slug: "360-virtual-staging",
    title: "360\u00b0 Virtual Staging",
    route: null,
    publicServiceSlug: "360-virtual-staging",
    availability: "coming-soon",
    sortOrder: 8,
  },
  {
    slug: "aerial-editing",
    title: "Aerial Editing",
    route: null,
    publicServiceSlug: "aerial-editing",
    availability: "custom-quote",
    sortOrder: 9,
  },
  {
    slug: "development-site-plans",
    title: "Development Site Plans",
    route: null,
    publicServiceSlug: "development-site-plans",
    availability: "custom-quote",
    sortOrder: 10,
  },
] as const satisfies readonly OrderServiceCanonicalFields[];

export type OrderServiceSlug = (typeof ORDER_SERVICE_CATALOG)[number]["slug"];
export type OrderServiceCatalogEntry = (typeof ORDER_SERVICE_CATALOG)[number];

export function getOrderServiceCatalog(): OrderServiceCanonicalFields[] {
  return ORDER_SERVICE_CATALOG.map((service) => ({ ...service })).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

export function getOrderServiceCatalogEntry(
  slug: string,
): OrderServiceCatalogEntry | null {
  const service = ORDER_SERVICE_CATALOG.find((item) => item.slug === slug);
  return service ? { ...service } : null;
}
