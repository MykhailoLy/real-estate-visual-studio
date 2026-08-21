import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import DayToDuskOrderForm from "@/components/order/day-to-dusk/DayToDuskOrderForm";
import { requireOrderingClient } from "@/lib/order-access";
import { DAY_TO_DUSK_MEDIA_KEYS } from "@/lib/day-to-dusk";
import { getServiceOptionImagesByKeys } from "@/lib/site-media";

export const dynamic = "force-dynamic";

const ROUTE = "/dashboard/orders/new/day-to-dusk";

export const metadata: Metadata = {
  title: "New Day to Dusk Order | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

export default async function NewDayToDuskOrderPage() {
  const { email } = await requireOrderingClient(ROUTE);

  // Batched fetch of admin-managed dusk-style example images (ONE query).
  // Serialised to a plain record so it can cross to the client form.
  const imageMap = await getServiceOptionImagesByKeys(DAY_TO_DUSK_MEDIA_KEYS);
  const duskStyleImages = Object.fromEntries(imageMap);

  return (
    <ClientDashboardLayout contentClassName="mx-auto w-full max-w-[1600px] py-0">
      <DayToDuskOrderForm
        clientEmail={email}
        orderRoute={ROUTE}
        duskStyleImages={duskStyleImages}
      />
    </ClientDashboardLayout>
  );
}
