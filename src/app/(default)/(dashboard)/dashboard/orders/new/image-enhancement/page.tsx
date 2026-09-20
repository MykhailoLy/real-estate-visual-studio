import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import ImageEnhancementTypeSelector from "@/components/order/image-enhancement/ImageEnhancementTypeSelector";
import { requireOrderingClient } from "@/lib/order-access";

// This route was previously the direct Image Enhancement order form.
// It is now a protected TYPE-SELECTION page (Single Exposure vs
// HDR / Bracketed). The New Order hub card still links here, and the
// public /order/image-enhancement compatibility route still redirects
// here, so authenticated clients land on the selector.

export const dynamic = "force-dynamic";

const ROUTE = "/dashboard/orders/new/image-enhancement";

export const metadata: Metadata = {
  title: "New Image Enhancement Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

export default async function NewImageEnhancementOrderPage() {
  await requireOrderingClient(ROUTE);
  return (
    <ClientDashboardLayout>
      <ImageEnhancementTypeSelector />
    </ClientDashboardLayout>
  );
}
