import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import VirtualStagingOrderForm from "@/components/order/virtual-staging/VirtualStagingOrderForm";
import { requireOrderingClient } from "@/lib/order-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Virtual Staging Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

const ORDER_ROUTE = "/dashboard/orders/new/virtual-staging";

export default async function NewVirtualStagingOrderPage() {
  const { email } = await requireOrderingClient(ORDER_ROUTE);
  return (
    <ClientDashboardLayout>
      <VirtualStagingOrderForm clientEmail={email} orderRoute={ORDER_ROUTE} />
    </ClientDashboardLayout>
  );
}
