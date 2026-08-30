import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import SingleExposureOrderForm from "@/components/order/image-enhancement/SingleExposureOrderForm";
import { requireOrderingClient } from "@/lib/order-access";
import { SINGLE_EXPOSURE_ORDER_MEDIA_KEYS } from "@/lib/image-enhancement";
import { getServiceOptionMediaByKeys } from "@/lib/site-media";
import { getWelcomeOfferAvailability } from "@/lib/welcome-offer-server";

export const dynamic = "force-dynamic";

const ROUTE = "/dashboard/orders/new/image-enhancement/single-exposure";

export const metadata: Metadata = {
  title: "Image Enhancement — Single Exposure | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

export default async function NewSingleExposureOrderPage() {
  const { email, userId } = await requireOrderingClient(ROUTE);
  const [media, welcomeOfferAvailability] = await Promise.all([
    getServiceOptionMediaByKeys(SINGLE_EXPOSURE_ORDER_MEDIA_KEYS),
    getWelcomeOfferAvailability(userId),
  ]);
  const exampleMediaByKey = Object.fromEntries(media);

  return (
    <ClientDashboardLayout contentClassName="mx-auto w-full max-w-[1800px] py-0">
      <SingleExposureOrderForm
        clientEmail={email}
        orderRoute={ROUTE}
        exampleMediaByKey={exampleMediaByKey}
        welcomeOfferAvailability={welcomeOfferAvailability}
      />
    </ClientDashboardLayout>
  );
}
