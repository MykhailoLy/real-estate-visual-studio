import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import VirtualRenovationOrderForm from "@/components/order/virtual-renovation/VirtualRenovationOrderForm";
import { requireOrderingClient } from "@/lib/order-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Virtual Renovation Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

const ORDER_ROUTE = "/dashboard/orders/new/virtual-renovation";

export default async function NewVirtualRenovationOrderPage() {
  const { email } = await requireOrderingClient(ORDER_ROUTE);
  return (
    <ClientDashboardLayout contentClassName="mx-auto w-full max-w-[1800px] py-0">
      <VirtualRenovationOrderForm clientEmail={email} orderRoute={ORDER_ROUTE} />
    </ClientDashboardLayout>
  );
}
