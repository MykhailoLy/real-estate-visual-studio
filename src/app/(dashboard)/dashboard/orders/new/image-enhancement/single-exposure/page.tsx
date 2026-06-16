import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import SingleExposureOrderForm from "@/components/order/image-enhancement/SingleExposureOrderForm";
import { requireOrderingClient } from "@/lib/order-access";
import { DAY_SKY_STYLES } from "@/lib/image-enhancement";
import { getServiceOptionImagesByKeys } from "@/lib/site-media";

export const dynamic = "force-dynamic";

const ROUTE = "/dashboard/orders/new/image-enhancement/single-exposure";

export const metadata: Metadata = {
  title: "Image Enhancement — Single Exposure | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

export default async function NewSingleExposureOrderPage() {
  const { email } = await requireOrderingClient(ROUTE);

  // Batched fetch of admin-managed day-sky example images (ONE query).
  // Serialised to a plain record so it can cross to the client form.
  const imageMap = await getServiceOptionImagesByKeys(
    DAY_SKY_STYLES.map((s) => s.mediaKey)
  );
  const daySkyImages = Object.fromEntries(imageMap);

  return (
    <ClientDashboardLayout>
      <SingleExposureOrderForm
        clientEmail={email}
        orderRoute={ROUTE}
        daySkyImages={daySkyImages}
      />
    </ClientDashboardLayout>
  );
}
