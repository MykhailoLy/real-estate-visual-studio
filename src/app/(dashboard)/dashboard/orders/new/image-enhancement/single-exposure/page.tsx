import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import SingleExposureOrderForm from "@/components/order/image-enhancement/SingleExposureOrderForm";
import { requireOrderingClient } from "@/lib/order-access";
import { SINGLE_EXPOSURE_ORDER_MEDIA_KEYS } from "@/lib/image-enhancement";
import { getServiceOptionMediaByKeys } from "@/lib/site-media";

export const dynamic = "force-dynamic";

const ROUTE = "/dashboard/orders/new/image-enhancement/single-exposure";

export const metadata: Metadata = {
  title: "Image Enhancement — Single Exposure | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

export default async function NewSingleExposureOrderPage() {
  const { email } = await requireOrderingClient(ROUTE);

  const exampleMediaByKey = Object.fromEntries(
    await getServiceOptionMediaByKeys(SINGLE_EXPOSURE_ORDER_MEDIA_KEYS),
  );

  return (
    <ClientDashboardLayout>
      <SingleExposureOrderForm
        clientEmail={email}
        orderRoute={ROUTE}
        exampleMediaByKey={exampleMediaByKey}
      />
    </ClientDashboardLayout>
  );
}
