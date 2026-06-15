import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import OrderServiceCard from "@/components/dashboard/OrderServiceCard";
import { getOrderServiceCards } from "@/lib/order-services";
import { getOrderCardImages } from "@/lib/order-card-media";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

// ============================================================
// /dashboard/orders/new — visual service-card catalog.
//
// Renders entirely from the central registry (src/lib/order-services.ts).
// Card images are admin-managed via /admin/media (section "order-card");
// services without a published image use a branded CSS fallback.
//
// Active services link to their dedicated form; coming-soon and
// custom-quote services stay visible but are non-interactive.
// ============================================================

export default async function NewOrderHubPage() {
  const services = getOrderServiceCards();
  // One query for all published order-card images, keyed by service slug.
  const images = await getOrderCardImages();

  return (
    <ClientDashboardLayout>
      <div className="px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-8 max-w-3xl">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark">
            Client Portal
          </p>
          <h1 className="text-2xl font-bold leading-tight text-primary sm:text-[28px]">
            Start a new order
          </h1>
          <p className="mt-1 text-sm text-muted">
            Choose a service to begin. Upload your photos, pick options, and
            receive professional results, typically within 24-48 hours.
          </p>
        </div>

        <ul
          role="list"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {services.map((service) => (
            <li key={service.slug} className="flex">
              <OrderServiceCard
                service={service}
                image={
                  service.mediaServiceSlug
                    ? images.get(service.mediaServiceSlug) ?? null
                    : null
                }
              />
            </li>
          ))}
        </ul>
      </div>
    </ClientDashboardLayout>
  );
}
