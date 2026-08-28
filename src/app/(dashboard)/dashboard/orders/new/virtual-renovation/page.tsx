import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import VirtualRenovationOrderForm from "@/components/order/virtual-renovation/VirtualRenovationOrderForm";
import { VirtualRenovationMediaProvider } from "@/components/order/virtual-renovation/VirtualRenovationMediaContext";
import { VIRTUAL_RENOVATION_MEDIA_KEYS } from "@/data/order-options";
import { requireOrderingClient } from "@/lib/order-access";
import { getServiceOptionMediaByKeys } from "@/lib/site-media";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Virtual Renovation Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

const ORDER_ROUTE = "/dashboard/orders/new/virtual-renovation";

export default async function NewVirtualRenovationOrderPage() {
  const [{ email }, media] = await Promise.all([
    requireOrderingClient(ORDER_ROUTE),
    getServiceOptionMediaByKeys(VIRTUAL_RENOVATION_MEDIA_KEYS),
  ]);

  return (
    <ClientDashboardLayout contentClassName="mx-auto w-full max-w-[1800px] py-0">
      <VirtualRenovationMediaProvider mediaByKey={Object.fromEntries(media)}>
        <VirtualRenovationOrderForm clientEmail={email} orderRoute={ORDER_ROUTE} />
      </VirtualRenovationMediaProvider>
    </ClientDashboardLayout>
  );
}
