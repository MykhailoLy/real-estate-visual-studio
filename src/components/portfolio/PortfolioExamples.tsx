import {
  getPortfolioPublicUrl,
  getPublishedItemsForService,
  type PortfolioServiceSlug,
} from "@/lib/portfolio";
import BeforeAfterFrame from "@/components/portfolio/BeforeAfterFrame";
import type { ServiceVariant } from "@/components/home/ServicePlaceholder";

// ============================================================
// PORTFOLIO EXAMPLES — pricing-page section
//
// Lists every published `portfolio_items` row for a single
// service slug. Renders nothing when the list is empty — the
// pricing pages already have their own large placeholder hero,
// so an empty "Examples" section would be visual noise.
//
// Server component. Pulls items + public URLs at request time;
// admin CRUD calls revalidatePath() for the matching pricing
// page, so the cache invalidates without a redeploy.
// ============================================================

export interface PortfolioExamplesProps {
  /** Canonical portfolio slug (one of the 10 in lib/portfolio.ts). */
  serviceSlug: PortfolioServiceSlug;
  /** Variant used by the placeholder fallback inside each card
   *  if a row exists but its images can't be resolved (rare —
   *  basically "Supabase env got stripped at runtime"). */
  placeholderVariant: ServiceVariant;
  /** Eyebrow shown above the section title. */
  eyebrow?: string;
  /** Section title. */
  title?: string;
  /** Section description. */
  description?: string;
  /** Background of the wrapping <section>. Defaults to the same
   *  white we use elsewhere on pricing pages. Pass "stone-50" for
   *  pages that need to alternate against an adjacent white block. */
  background?: "white" | "stone-50";
}

export default async function PortfolioExamples({
  serviceSlug,
  placeholderVariant,
  eyebrow = "Examples",
  title = "Before & after examples",
  description = "Recent work uploaded by the PicchuSpot team. New examples are added regularly.",
  background = "white",
}: PortfolioExamplesProps) {
  const items = await getPublishedItemsForService(serviceSlug);

  // No portfolio items uploaded yet → render nothing. The page's
  // existing hero/preview already supplies a placeholder visual,
  // so we never show an empty broken Examples section.
  if (items.length === 0) return null;

  const sectionBg =
    background === "stone-50" ? "bg-stone-50" : "bg-white";

  return (
    <section className={`py-16 lg:py-24 ${sectionBg}`}>
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="max-w-3xl mb-10 lg:mb-14">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
            {eyebrow}
          </p>
          <h2 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05]">
            {title}
          </h2>
          {description && (
            <p className="mt-4 text-base lg:text-lg text-muted leading-relaxed">
              {description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
          {items.map((item) => {
            const beforeUrl = getPortfolioPublicUrl(item.before_image_path);
            const afterUrl = getPortfolioPublicUrl(item.after_image_path);
            return (
              <article
                key={item.id}
                className="group bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
              >
                {/* 5:2 frame matches the homepage service grid so
                    the same uploaded photo composition reads the
                    same way across the site. */}
                <div className="aspect-[5/2] relative overflow-hidden bg-stone-100">
                  <BeforeAfterFrame
                    beforeUrl={beforeUrl}
                    afterUrl={afterUrl}
                    beforeAlt={item.before_alt || `${item.title} before`}
                    afterAlt={item.after_alt || `${item.title} after`}
                    placeholderVariant={placeholderVariant}
                  />
                </div>
                <div className="p-5 lg:p-6">
                  <h3 className="text-base lg:text-lg font-bold text-primary tracking-tight">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="mt-1.5 text-sm text-muted leading-relaxed line-clamp-3">
                      {item.description}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
