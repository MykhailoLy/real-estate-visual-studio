import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/layout/Container";
import { RegionalPriceText } from "@/components/pricing/currency-client";
import { regionalPrice, type RegionalPrice } from "@/lib/currency";
import { ImagePlus, Paintbrush, LayoutGrid, SlidersHorizontal } from "lucide-react";

export const metadata: Metadata = {
  title: "Order Remote Services",
  description:
    "Order virtual staging, virtual renovation, 3D floor plans, or real estate photo editing online. Fast delivery in 24-48 hours.",
};

const services = [
  {
    href: "/order/virtual-staging",
    icon: ImagePlus,
    title: "Virtual Staging",
    description:
      "Furnish empty rooms with realistic furniture and decor. Choose from 9 styles.",
    price: regionalPrice("From $19.00 / image", "From €19.00 / image"),
  },
  {
    href: "/order/virtual-renovation",
    icon: Paintbrush,
    title: "Virtual Renovation",
    description:
      "Digitally renovate kitchens, bathrooms, exteriors, and more. Option-based pricing.",
    price: regionalPrice("From $3.00 / option", "From €3.00 / option"),
  },
  {
    href: "/order/3d-floor-plans",
    icon: LayoutGrid,
    title: "2D / 3D Floor Plans",
    description:
      "Professional floor plans from your sketches, photos, or existing plans.",
    price: regionalPrice("From $16.00 / floor", "From €16.00 / floor"),
  },
  {
    href: "/order/photo-editing",
    icon: SlidersHorizontal,
    title: "Real Estate Photo Editing",
    description:
      "Image enhancement, day to dusk, item removal, sky replacement, and more.",
    price: regionalPrice("From $1.00 / option", "From €1.00 / option"),
  },
];

function OrderServicePrice({ price }: { price: RegionalPrice }) {
  return <RegionalPriceText price={price} />;
}

export default function OrderPage() {
  return (
    <section className="py-12 lg:py-20 bg-surface min-h-screen">
      <Container>
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="text-3xl lg:text-5xl font-bold text-primary mb-4">
            Order Remote Services
          </h1>
          <p className="text-lg text-muted">
            Select a service below to start your order. Upload photos, choose
            options, and receive results in 24-48 hours.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <Link
                key={service.href}
                href={service.href}
                className="group flex flex-col bg-white border border-border rounded-xl p-6 hover:border-primary/50 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {service.title}
                  </h2>
                </div>
                <p className="text-sm text-muted flex-1 mb-4">
                  {service.description}
                </p>
                <span className="text-sm font-medium text-primary">
                  <OrderServicePrice price={service.price} />
                </span>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
