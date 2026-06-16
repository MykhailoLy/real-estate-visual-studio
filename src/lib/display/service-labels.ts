import { getDedicatedSubServiceLabel } from "@/lib/dedicated-photo-editing";

export const SERVICE_LABELS: Record<string, string> = {
  "virtual-staging": "Virtual Staging",
  "virtual-renovation": "Virtual Renovation",
  "3d-floor-plans": "Floor Plans",
  "photo-editing": "Photo Editing",
  "image-enhancement": "Image Enhancement",
  "day-to-dusk": "Day to Dusk",
  "item-removal": "Item Removal",
  "virtual-cleaning": "Virtual Cleaning",
  "360-image-enhancement": "360° Image Enhancement",
  "360-virtual-staging": "360° Virtual Staging",
  "aerial-editing": "Aerial Editing",
  "development-site-plans": "Development Site Plans",
  "online-retail": "Online Retail",
  renders: "Renders",
  local: "Local Services",
};

export function getServiceLabel(slug: string): string {
  return SERVICE_LABELS[slug] ?? slugToLabel(slug);
}

/**
 * Resolve the label an ORDER should display. Dedicated photo-editing
 * orders carry a `sub_service` (e.g. "image-enhancement") in their first
 * order item's details — when present and recognised, we show the
 * dedicated label; otherwise we fall back to the broad service_type label
 * (so historical/generic Photo Editing orders still read "Photo Editing").
 */
export function getOrderServiceLabel(
  serviceType: string,
  subService?: string | null,
): string {
  const dedicated = getDedicatedSubServiceLabel(subService);
  return dedicated ?? getServiceLabel(serviceType);
}

function slugToLabel(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
