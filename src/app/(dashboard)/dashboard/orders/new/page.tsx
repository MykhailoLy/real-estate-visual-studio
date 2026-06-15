import type { Metadata } from "next";
import Link from "next/link";
import { ImagePlus, Paintbrush, LayoutGrid, SlidersHorizontal } from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import { RegionalPriceText } from "@/components/pricing/currency-client";
import { regionalPrice, type RegionalPrice } from "@/lib/currency";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

// Four currently-supported services. Hrefs point at the protected
// dashboard order routes (PR 2). The visual hub itself is unchanged
// from the previous public hub — a fuller redesign is deferred to PR 3.
const services = [
  {
    href: "/dashboard/orders/new/virtual-staging",
    icon: ImagePlus,
    title: "Virtual Staging",
    description:
      "Furnish empty rooms with realistic furniture and decor. Choose from 9 styles.",
    price: regionalPrice("From $19.00 / image", "From €19.00 / image"),
  },
  {
    href: "/dashboard/orders/new/virtual-renovation",
    icon: Paintbrush,
    title: "Virtual Renovation",
    description:
      "Digitally renovate kitchens, bathrooms, exteriors, and more. Option-based pricing.",
    price: regionalPrice("From $3.00 / option", "From €3.00 / option"),
  },
  {
    href: "/dashboard/orders/new/3d-floor-plans",
    icon: LayoutGrid,
    title: "2D / 3D Floor Plans",
    description:
      "Professional floor plans from your sketches, photos, or existing plans.",
    price: regionalPrice("From $16.00 / floor", "From €16.00 / floor"),
  },
  {
    href: "/dashboard/orders/new/photo-editing",
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

export default function NewOrderHubPage() {
  return (
    <ClientDashboardLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        <div className="max-w-3xl mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark mb-1.5">
            Client Portal
          </p>
          <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
            Start a new order
          </h1>
          <p className="text-muted mt-1 text-sm">
            Select a service to begin. Upload photos, choose options, and receive
            results in 24-48 hours.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl">
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
      </div>
    </ClientDashboardLayout>
  );
}
