import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import VirtualStagingOrderForm from "@/components/order/virtual-staging/VirtualStagingOrderForm";
import { VIRTUAL_STAGING_MEDIA_KEYS } from "@/data/order-options";
import { requireOrderingClient } from "@/lib/order-access";
import { getServiceOptionMediaByKeys } from "@/lib/site-media";
import { getWelcomeOfferAvailability } from "@/lib/welcome-offer-server";
import { NO_WELCOME_OFFER_AVAILABLE } from "@/lib/welcome-offer";
import { getDashboardRequestUser } from "@/lib/dashboard-request-context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Virtual Staging Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

const ORDER_ROUTE = "/dashboard/orders/new/virtual-staging";

export default async function NewVirtualStagingOrderPage() {
  const { email, userId } = await requireOrderingClient(ORDER_ROUTE);
  const isQaPreview = (await getDashboardRequestUser())?.isQaPreview === true;
  const [media, welcomeOfferAvailability] = await Promise.all([
    getServiceOptionMediaByKeys(VIRTUAL_STAGING_MEDIA_KEYS),
    isQaPreview
      ? Promise.resolve(NO_WELCOME_OFFER_AVAILABLE)
      : getWelcomeOfferAvailability(userId),
  ]);
  const exampleMedia = Object.fromEntries(media);
  return (
    <ClientDashboardLayout flush>
      <VirtualStagingOrderForm
        clientEmail={email}
        orderRoute={ORDER_ROUTE}
        exampleMediaByKey={exampleMedia}
        welcomeOfferAvailability={welcomeOfferAvailability}
      />
    </ClientDashboardLayout>
  );
}
