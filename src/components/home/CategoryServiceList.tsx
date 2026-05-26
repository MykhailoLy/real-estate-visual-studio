import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ServicePlaceholder, {
  type ServiceVariant,
} from "./ServicePlaceholder";

// ============================================================
// CATEGORY SERVICE LIST
//
// Lighter-weight version of the homepage ServiceGrid used by the
// /local, /renders, and /online-retail landing pages. Renders one
// card per second-row service link; every card defaults to a
// "Request Quote" CTA pointing at /contact, which is the
// pre-launch posture for these categories.
// ============================================================

export interface CategoryServiceItem {
  /** Anchor id matching the second-row sub-nav. */
  id: string;
  variant: ServiceVariant;
  name: string;
  description: string;
  /** Optional override for the primary CTA. Defaults to /contact. */
  ctaHref?: string;
  /** Optional CTA label override. Defaults to "Request Quote". */
  ctaLabel?: string;
}

interface CategoryServiceListProps {
  /** Eyebrow above the heading. */
  eyebrow: string;
  heading: string;
  intro?: string;
  items: CategoryServiceItem[];
}

export default function CategoryServiceList({
  eyebrow,
  heading,
  intro,
  items,
}: CategoryServiceListProps) {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="max-w-3xl mb-10 lg:mb-14">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
            {eyebrow}
          </p>
          <h2 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.1]">
            {heading}
          </h2>
          {intro && (
            <p className="mt-4 text-base lg:text-lg text-muted leading-relaxed">
              {intro}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {items.map((item) => {
            const ctaHref = item.ctaHref || "/contact";
            const ctaLabel = item.ctaLabel || "Request Quote";
            return (
              <article
                key={item.id}
                id={item.id}
                className="group flex flex-col bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 scroll-mt-32"
              >
                <div className="aspect-[4/3] relative overflow-hidden bg-stone-100">
                  <ServicePlaceholder variant={item.variant} />
                </div>
                <div className="p-5 lg:p-6 flex-1 flex flex-col">
                  <h3 className="text-lg lg:text-xl font-bold text-primary leading-tight">
                    {item.name}
                  </h3>
                  <p className="mt-3 text-sm text-muted leading-relaxed flex-1">
                    {item.description}
                  </p>
                  <div className="mt-5 pt-5 border-t border-stone-100">
                    <Link
                      href={ctaHref}
                      className="inline-flex items-center justify-center gap-1.5 w-full px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-colors"
                    >
                      {ctaLabel}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
