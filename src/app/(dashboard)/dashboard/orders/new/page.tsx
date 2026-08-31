import type { Metadata } from "next";
import { Suspense } from "react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import OrderServiceGrid from "@/components/dashboard/OrderServiceGrid";
import {
  getOrderServiceCards,
  type OrderServiceCard,
} from "@/lib/order-services";
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
// Uses the shared wide client-workspace shell so the grid fills the main
// area on large screens without diverging from the rest of the portal.
// Two batched queries total (portfolio + order-card media), grouped
// server-side — never one query per card.
// ============================================================

async function EnrichedOrderServiceGrid({
  services,
}: {
  services: readonly OrderServiceCard[];
}) {
  // Two batched reads for the whole hub (no per-card queries).
  const [images, examples] = await Promise.all([
    getOrderCardImages(),
    getOrderServiceExamples(),
  ]);

  return (
    <OrderServiceGrid
      services={services}
      images={images}
      examples={examples}
    />
  );
}

export default function NewOrderHubPage() {
  const services = getOrderServiceCards();

  return (
    <ClientDashboardLayout>
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

      <Suspense fallback={<OrderServiceGrid services={services} />}>
        <EnrichedOrderServiceGrid services={services} />
      </Suspense>
    </ClientDashboardLayout>
  );
}
