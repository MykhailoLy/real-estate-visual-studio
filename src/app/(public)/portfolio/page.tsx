import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ImagePlus,
  LayoutGrid,
  Paintbrush,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import Container from "@/components/layout/Container";
import BeforeAfterFrame from "@/components/portfolio/BeforeAfterFrame";
import {
  getPortfolioPublicUrl,
  getPortfolioService,
  getPublishedItemsForService,
  type PortfolioItem,
  type PortfolioServiceSlug,
} from "@/lib/portfolio";

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "Explore PicchuSpot real estate visual service categories and selected public portfolio examples when available.",
};

const featuredCategories: {
  slug: PortfolioServiceSlug;
  title: string;
  description: string;
  icon: typeof ImagePlus;
  href: string;
}[] = [
  {
    slug: "virtual-staging",
    title: "Virtual Staging",
    description:
      "Furnish empty rooms with realistic styling for residential or commercial listings.",
    icon: ImagePlus,
    href: "/pricing/virtual-staging",
  },
  {
    slug: "virtual-renovation",
    title: "Virtual Renovation",
    description:
      "Show renovation potential for interiors, exteriors, finishes, kitchens, bathrooms, and outdoor spaces.",
    icon: Paintbrush,
    href: "/pricing/virtual-renovation",
  },
  {
    slug: "floor-plans",
    title: "Floor Plans",
    description:
      "Turn sketches, measurements, or existing plans into clear 2D or 3D listing floor plans.",
    icon: LayoutGrid,
    href: "/pricing/floor-plans",
  },
  {
    slug: "item-removal-virtual-cleaning",
    title: "Photo Editing",
    description:
      "Clean, correct, and prepare real estate images for stronger listing presentation.",
    icon: SlidersHorizontal,
    href: "/pricing/photo-editing",
  },
  {
    slug: "image-enhancement",
    title: "Image Enhancement",
    description:
      "Improve brightness, color, clarity, and overall polish while keeping images natural.",
    icon: Sparkles,
    href: "/pricing/image-enhancement",
  },
];

async function getSelectedPortfolioItems(): Promise<PortfolioItem[]> {
  const grouped = await Promise.all(
    featuredCategories.map(async (category) => {
      const items = await getPublishedItemsForService(category.slug);
      return items.slice(0, 2);
    })
  );

  return grouped.flat().slice(0, 6);
}

export default async function PortfolioPage() {
  const selectedItems = await getSelectedPortfolioItems();

  return (
    <section className="py-16 lg:py-24 bg-white">
      <Container>
        <div className="max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
            Portfolio
          </p>
          <h1 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05] mb-5">
            Real estate visual services for clearer presentation
          </h1>
          <p className="text-base lg:text-lg text-muted leading-relaxed">
            A curated gallery is being prepared. Contact us for relevant
            samples, or explore the core service categories below to see what
            PicchuSpot can prepare for your listing workflow.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/services"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors shadow-sm"
            >
              View services
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl text-sm font-bold text-primary hover:border-primary/40 hover:bg-surface transition-colors"
            >
              View pricing
            </Link>
            <Link
              href="/order"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl text-sm font-bold text-primary hover:border-primary/40 hover:bg-surface transition-colors"
            >
              Start an order
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl text-sm font-bold text-primary hover:border-primary/40 hover:bg-surface transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>

        {selectedItems.length > 0 && (
          <div className="mt-14">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
                  Selected work
                </p>
                <h2 className="text-2xl lg:text-3xl font-bold text-primary">
                  Published examples
                </h2>
              </div>
              <p className="text-sm text-muted max-w-xl">
                Public examples are shown only when portfolio items have been
                published through the PicchuSpot admin workflow.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {selectedItems.map((item) => {
                const service = getPortfolioService(item.service_slug);
                return (
                  <article
                    key={item.id}
                    className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm"
                  >
                    <div className="aspect-[5/2] relative overflow-hidden bg-surface">
                      <BeforeAfterFrame
                        beforeUrl={getPortfolioPublicUrl(item.before_image_path)}
                        afterUrl={getPortfolioPublicUrl(item.after_image_path)}
                        beforeAlt={item.before_alt || `${item.title} before`}
                        afterAlt={item.after_alt || `${item.title} after`}
                        placeholderVariant={service.placeholderVariant}
                      />
                    </div>
                    <div className="p-5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary-dark mb-2">
                        {service.label}
                      </p>
                      <h3 className="text-lg font-bold text-primary">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="mt-2 text-sm text-muted leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5">
          {featuredCategories.map((category) => (
            <Link
              key={category.title}
              href={category.href}
              className="group bg-surface border border-border rounded-2xl p-6 hover:bg-white hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center mb-5 group-hover:border-primary/30">
                <category.icon
                  className="w-5 h-5 text-secondary-dark"
                  aria-hidden
                />
              </div>
              <h2 className="text-lg font-bold text-primary mb-2">
                {category.title}
              </h2>
              <p className="text-sm text-muted leading-relaxed mb-5">
                {category.description}
              </p>
              <span className="inline-flex items-center gap-2 text-sm font-bold text-primary group-hover:text-primary-light transition-colors">
                Learn more
                <ArrowRight className="w-4 h-4" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
