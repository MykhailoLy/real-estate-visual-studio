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

function slugToLabel(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
