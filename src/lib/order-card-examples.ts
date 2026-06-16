// ============================================================
// ORDER CARD EXAMPLES — Before/After portfolio examples for the
// authenticated New Order hub.
//
// Reuses the public portfolio system as the source of truth
// (portfolio_items, published, show_in_gallery=true) via the batch
// reader getGalleryItemsGroupedByService() — ONE query for all
// services, grouped server-side. Images are NOT duplicated into
// site_media; we only resolve public URLs with the existing helper.
//
// Each returned pair is COMPLETE (both before+after URLs resolve);
// incomplete records are dropped. Ordering is preserved from the
// portfolio reader (featured_home, then sort_order, then created_at).
// Degrades to an empty Map when Supabase is unavailable.
// ============================================================

import {
  getGalleryItemsGroupedByService,
  getPortfolioPublicUrl,
  type PortfolioServiceSlug,
} from "@/lib/portfolio";

/** A complete Before/After example, ready to render. Serializable. */
export interface OrderExamplePair {
  id: string;
  beforeUrl: string;
  afterUrl: string;
  beforeAlt: string;
  afterAlt: string;
}

/**
 * Returns a Map of portfolio service slug → complete Before/After
 * pairs (gallery-eligible, ordered). Services with no complete pair
 * are absent from the Map. The first entry per service is the card
 * preview; the full array feeds the examples modal.
 */
export async function getOrderServiceExamples(): Promise<
  Map<PortfolioServiceSlug, OrderExamplePair[]>
> {
  const grouped = await getGalleryItemsGroupedByService();
  const out = new Map<PortfolioServiceSlug, OrderExamplePair[]>();

  for (const [slug, items] of grouped) {
    const pairs: OrderExamplePair[] = [];
    for (const item of items) {
      const beforeUrl = getPortfolioPublicUrl(item.before_image_path);
      const afterUrl = getPortfolioPublicUrl(item.after_image_path);
      if (!beforeUrl || !afterUrl) continue; // skip single-sided records
      pairs.push({
        id: item.id,
        beforeUrl,
        afterUrl,
        beforeAlt: item.before_alt ?? `${item.title} — before`,
        afterAlt: item.after_alt ?? `${item.title} — after`,
      });
    }
    if (pairs.length > 0) out.set(slug, pairs);
  }

  return out;
}
