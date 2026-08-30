import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import ItemRemovalOrderForm from "@/components/order/item-removal/ItemRemovalOrderForm";
import { requireOrderingClient } from "@/lib/order-access";

export const dynamic = "force-dynamic";

const ROUTE = "/dashboard/orders/new/item-removal-virtual-cleaning";

export const metadata: Metadata = {
  title: "New Item Removal & Virtual Cleaning Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

export default async function NewItemRemovalOrderPage() {
  const { email } = await requireOrderingClient(ROUTE);
  return (
    <ClientDashboardLayout contentClassName="mx-auto w-full max-w-[1800px] py-0">
      <ItemRemovalOrderForm clientEmail={email} orderRoute={ROUTE} />
    </ClientDashboardLayout>
  );
}
