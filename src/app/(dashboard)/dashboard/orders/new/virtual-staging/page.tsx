import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import VirtualStagingOrderForm from "@/components/order/virtual-staging/VirtualStagingOrderForm";
import { VIRTUAL_STAGING_MEDIA_KEYS } from "@/data/order-options";
import { requireOrderingClient } from "@/lib/order-access";
import { getServiceOptionMediaByKeys } from "@/lib/site-media";
import { getWelcomeOfferAvailability } from "@/lib/welcome-offer-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Virtual Staging Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

const ORDER_ROUTE = "/dashboard/orders/new/virtual-staging";

export default async function NewVirtualStagingOrderPage() {
  const { email, userId } = await requireOrderingClient(ORDER_ROUTE);
  const [media, welcomeOfferAvailability] = await Promise.all([
    getServiceOptionMediaByKeys(VIRTUAL_STAGING_MEDIA_KEYS),
    getWelcomeOfferAvailability(userId),
  ]);
  const exampleMedia = Object.fromEntries(media);
  return (
    <ClientDashboardLayout contentClassName="mx-auto w-full max-w-[1800px] py-0">
      <VirtualStagingOrderForm
        clientEmail={email}
        orderRoute={ORDER_ROUTE}
        exampleMediaByKey={exampleMedia}
        welcomeOfferAvailability={welcomeOfferAvailability}
      />
    </ClientDashboardLayout>
  );
}
