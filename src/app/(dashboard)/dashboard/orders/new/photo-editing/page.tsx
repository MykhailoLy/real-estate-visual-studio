import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import PhotoEditingOrderForm from "@/components/order/photo-editing/PhotoEditingOrderForm";
import { requireOrderingClient } from "@/lib/order-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Photo Editing Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

const ORDER_ROUTE = "/dashboard/orders/new/photo-editing";

export default async function NewPhotoEditingOrderPage() {
  const { email } = await requireOrderingClient(ORDER_ROUTE);
  return (
    <ClientDashboardLayout contentClassName="mx-auto w-full max-w-[1800px] py-0">
      <PhotoEditingOrderForm clientEmail={email} orderRoute={ORDER_ROUTE} />
    </ClientDashboardLayout>
  );
}
