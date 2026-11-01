import { unstable_cache } from "next/cache";
import { PORTFOLIO_SERVICE_SLUGS } from "@/lib/portfolio-service-meta";
import { createServerClient } from "@/lib/supabase";

export const GALLERY_SITEMAP_TAG = "gallery-sitemap";

const readGallerySlugs = unstable_cache(
  async () => {
    const supabase = createServerClient();
    const remaining = new Set(PORTFOLIO_SERVICE_SLUGS);
    // Ask only about unconfirmed services. Even a capped response containing
    // just one service eliminates it from the next query.
    while (remaining.size > 0) {
      const { data, error } = await supabase.from("portfolio_items")
        .select("service_slug")
        .in("service_slug", [...remaining])
        .eq("published", true)
        .eq("show_in_gallery", true)
        .neq("before_image_path", "")
        .neq("after_image_path", "")
        .limit(PORTFOLIO_SERVICE_SLUGS.length);
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Missing portfolio query result");
      if (data.length === 0) break;
      for (const row of data) remaining.delete(row.service_slug);
    }
    return PORTFOLIO_SERVICE_SLUGS.filter((slug) => !remaining.has(slug));
  },
  [GALLERY_SITEMAP_TAG, process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""],
  { tags: [GALLERY_SITEMAP_TAG], revalidate: 300 },
);

export async function getGallerySitemapSlugs() {
  try {
    return await readGallerySlugs();
  } catch (err) {
    // A failed refresh retains the last successful Next.js Data Cache entry.
    // With no prior entry, serve only the independently known public routes.
    console.warn("sitemap: no confirmed gallery list available", err);
    return [];
  }
}
