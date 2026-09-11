import Link from "next/link";
import Container from "@/components/layout/Container";
import SectionHeader from "./SectionHeader";
import { ImagePlus, LayoutGrid, SlidersHorizontal } from "lucide-react";
import { CatalogPriceText } from "@/components/pricing/currency-client";
import type { PriceKey } from "@/lib/pricing/types";

const teaserCards: Array<{
  icon: typeof ImagePlus;
  title: string;
  priceKey: PriceKey;
  prefix?: string;
  unit: string;
  href: string;
}> = [
  {
    icon: ImagePlus,
    title: "Virtual Staging",
    priceKey: "virtual-staging",
    unit: "per image",
    href: "/dashboard/orders/new/virtual-staging",
  },
  {
    icon: LayoutGrid,
    title: "2D / 3D Floor Plans",
    priceKey: "floor-plan-2d-bw",
    prefix: "From ",
    unit: "per floor",
    href: "/dashboard/orders/new/3d-floor-plans",
  },
  {
    icon: SlidersHorizontal,
    title: "Photo Editing",
    priceKey: "turn-on-lights",
    prefix: "From ",
    unit: "per option",
    href: "/dashboard/orders/new/photo-editing",
  },
];

export default function PricingTeaser() {
  return (
    <section className="py-16 lg:py-24">
      <Container>
        <SectionHeader
          title="Transparent Per-Image Pricing"
          subtitle="No subscriptions, no hidden fees. Pay only for what you need."
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto mb-10">
          {teaserCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.href}
                className="group bg-white border border-border rounded-xl p-6 text-center hover:border-primary/50 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                  <Icon className="w-6 h-6" />
                </div>
                <p className="font-semibold text-foreground text-sm mb-1">
                  {card.title}
                </p>
                <p className="text-xl font-bold text-primary">
                  <CatalogPriceText
                    priceKey={card.priceKey}
                    prefix={card.prefix}
                  />
                </p>
                <p className="text-xs text-muted">{card.unit}</p>
              </Link>
            );
          })}
        </div>

        <div className="text-center">
          <Link
            href="/pricing"
            className="text-sm font-medium text-primary hover:text-primary-light underline transition-colors"
          >
            View All Pricing →
          </Link>
        </div>
      </Container>
    </section>
  );
}
