import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import DedicatedPhotoEditingOrderForm from "@/components/order/photo-editing/DedicatedPhotoEditingOrderForm";
import { requireOrderingClient } from "@/lib/order-access";
import { DEDICATED_PHOTO_EDITING_CONFIGS } from "@/lib/dedicated-photo-editing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Day to Dusk Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

const CONFIG = DEDICATED_PHOTO_EDITING_CONFIGS["day-to-dusk"];

export default async function NewDayToDuskOrderPage() {
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
