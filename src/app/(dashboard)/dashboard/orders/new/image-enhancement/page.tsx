import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import DedicatedPhotoEditingOrderForm from "@/components/order/photo-editing/DedicatedPhotoEditingOrderForm";
import { requireOrderingClient } from "@/lib/order-access";
import { DEDICATED_PHOTO_EDITING_CONFIGS } from "@/lib/dedicated-photo-editing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Image Enhancement Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

const CONFIG = DEDICATED_PHOTO_EDITING_CONFIGS["image-enhancement"];

export default async function NewImageEnhancementOrderPage() {
  const { email } = await requireOrderingClient(CONFIG.route);
  return (
    <ClientDashboardLayout>
      <DedicatedPhotoEditingOrderForm
        config={CONFIG}
        clientEmail={email}
        orderRoute={CONFIG.route}
      />
    </ClientDashboardLayout>
  );
}
