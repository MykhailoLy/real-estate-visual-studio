import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import FloorPlansOrderForm from "@/components/order/floor-plans/FloorPlansOrderForm";
import { requireOrderingClient } from "@/lib/order-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Floor Plan Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

const ORDER_ROUTE = "/dashboard/orders/new/3d-floor-plans";

export default async function NewFloorPlansOrderPage() {
  const { email } = await requireOrderingClient(ORDER_ROUTE);
  return (
    <ClientDashboardLayout>
      <FloorPlansOrderForm clientEmail={email} orderRoute={ORDER_ROUTE} />
    </ClientDashboardLayout>
  );
}
