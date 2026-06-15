// ============================================================
// ORDER CARD MEDIA — public reader for New Order hub cards
//
// Resolves the admin-managed card image for an order service from
// the existing site-media system:
//   section      = "order-card"
//   media_type   = "image"
//   service_slug = <order service slug>
//   published    = true   (drafts are never exposed)
//
// Reuses getPublishedSiteMediaForSection (which already filters to
// published rows and orders by sort_order) and the existing public
// URL helper. Fails gracefully (empty map / null) when Supabase is
// unconfigured or no image exists, so the hub falls back to a
// branded CSS placeholder.
// ============================================================

import {
  getPublishedSiteMediaForSection,
  getSiteMediaPublicUrl,
} from "@/lib/site-media";

export interface OrderCardImage {
  url: string;
  alt: string | null;
}

/**
 * Load every published order-card image, keyed by service_slug.
 * First published image per slug (by sort_order) wins. One query
 * for the whole hub.
 */
export async function getOrderCardImages(): Promise<
  Map<string, OrderCardImage>
> {
  const out = new Map<string, OrderCardImage>();
  const items = await getPublishedSiteMediaForSection("order-card");

  for (const item of items) {
    if (item.media_type !== "image") continue;
    if (!item.service_slug || !item.image_path) continue;
    if (out.has(item.service_slug)) continue; // first (lowest sort_order) wins
    const url = getSiteMediaPublicUrl(item.image_path);
    if (!url) continue;
    out.set(item.service_slug, { url, alt: item.alt_text });
  }

  return out;
}

/** Single-service convenience reader. Returns null when none exists. */
export async function getOrderCardImage(
  serviceSlug: string,
): Promise<OrderCardImage | null> {
  const all = await getOrderCardImages();
  return all.get(serviceSlug) ?? null;
}
