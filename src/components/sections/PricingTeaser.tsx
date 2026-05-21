import Link from "next/link";
import Container from "@/components/layout/Container";
import SectionHeader from "./SectionHeader";
import { ImagePlus, LayoutGrid, SlidersHorizontal } from "lucide-react";

const teaserCards = [
  {
    icon: ImagePlus,
    title: "Virtual Staging",
    price: "US$19.00",
    unit: "per image",
    href: "/order/virtual-staging",
  },
  {
    icon: LayoutGrid,
    title: "2D / 3D Floor Plans",
    price: "From US$16.00",
    unit: "per floor",
    href: "/order/3d-floor-plans",
  },
  {
    icon: SlidersHorizontal,
    title: "Photo Editing",
    price: "From US$1.00",
    unit: "per option",
    href: "/order/photo-editing",
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
                <p className="text-xl font-bold text-primary">{card.price}</p>
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
