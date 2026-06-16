import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import DedicatedPhotoEditingOrderForm from "@/components/order/photo-editing/DedicatedPhotoEditingOrderForm";
import { requireOrderingClient } from "@/lib/order-access";
import { DEDICATED_PHOTO_EDITING_CONFIGS } from "@/lib/dedicated-photo-editing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Item Removal & Virtual Cleaning Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

const CONFIG = DEDICATED_PHOTO_EDITING_CONFIGS["item-removal-virtual-cleaning"];

export default async function NewItemRemovalOrderPage() {
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
