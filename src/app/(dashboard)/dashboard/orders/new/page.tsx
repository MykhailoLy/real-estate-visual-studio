import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import OrderServiceCard from "@/components/dashboard/OrderServiceCard";
import SavedDraftsSection from "@/components/dashboard/SavedDraftsSection";
import { getOrderServiceCards } from "@/lib/order-services";
import { getOrderCardImages } from "@/lib/order-card-media";
import { getOrderServiceExamples } from "@/lib/order-card-examples";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

// ============================================================
// /dashboard/orders/new — visual service-card catalog.
//
// Renders entirely from the central registry (src/lib/order-services.ts).
// Each card's media is resolved in priority order:
//   1. first complete published Portfolio Before/After pair
//      (portfolio_items, show_in_gallery) — also feeds a "View
//      Examples" modal,
//   2. else the admin-managed order-card image (/admin/media),
//   3. else a branded CSS fallback.
//
// Uses the dashboard layout's full-width content option so the grid
// fills the main area on large screens (other pages keep max-w-6xl).
// Two batched queries total (portfolio + order-card media), grouped
// server-side — never one query per card.
// ============================================================

export default async function NewOrderHubPage() {
  const services = getOrderServiceCards();

  // Two batched reads for the whole hub (no per-card queries).
  const [images, examples] = await Promise.all([
    getOrderCardImages(),
    getOrderServiceExamples(),
  ]);

  return (
    <ClientDashboardLayout contentClassName="w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8 2xl:px-10">
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

      <SavedDraftsSection />

      <ul
        role="list"
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      >
        {services.map((service) => (
          <li key={service.slug} className="flex">
            <OrderServiceCard
              slug={service.slug}
              examples={
                service.portfolioServiceSlug
                  ? examples.get(service.portfolioServiceSlug) ?? []
                  : []
              }
              cardImage={
                service.mediaServiceSlug
                  ? images.get(service.mediaServiceSlug) ?? null
                  : null
              }
            />
          </li>
        ))}
      </ul>
    </ClientDashboardLayout>
  );
}
