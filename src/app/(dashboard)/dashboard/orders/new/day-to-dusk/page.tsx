import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import DayToDuskOrderForm from "@/components/order/day-to-dusk/DayToDuskOrderForm";
import { requireOrderingClient } from "@/lib/order-access";
import { DAY_TO_DUSK_MEDIA_KEYS } from "@/lib/day-to-dusk";
import { getServiceOptionImagesByKeys } from "@/lib/site-media";
import { getWelcomeOfferAvailability } from "@/lib/welcome-offer-server";
import { NO_WELCOME_OFFER_AVAILABLE } from "@/lib/welcome-offer";
import { getDashboardRequestUser } from "@/lib/dashboard-request-context";

export const dynamic = "force-dynamic";

const ROUTE = "/dashboard/orders/new/day-to-dusk";

export const metadata: Metadata = {
  title: "New Day to Dusk Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

export default async function NewDayToDuskOrderPage() {
  const { email, userId } = await requireOrderingClient(ROUTE);
  const isQaPreview = (await getDashboardRequestUser())?.isQaPreview === true;

  // Batched fetch of admin-managed dusk-style example images (ONE query).
  // Serialised to a plain record so it can cross to the client form.
  const [imageMap, welcomeOfferAvailability] = await Promise.all([
    getServiceOptionImagesByKeys(DAY_TO_DUSK_MEDIA_KEYS),
    isQaPreview
      ? Promise.resolve(NO_WELCOME_OFFER_AVAILABLE)
      : getWelcomeOfferAvailability(userId),
  ]);
  const duskStyleImages = Object.fromEntries(imageMap);

  return (
    <ClientDashboardLayout flush>
      <DayToDuskOrderForm
        clientEmail={email}
        orderRoute={ROUTE}
        duskStyleImages={duskStyleImages}
        welcomeOfferAvailability={welcomeOfferAvailability}
      />
    </ClientDashboardLayout>
  );
}
