import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import GuestVirtualStagingEntry from "@/components/order/virtual-staging/GuestVirtualStagingEntry";
import { GUEST_ENTRY, guestDraftsEnabled } from "@/lib/guest-order-drafts/entry";
import { GUEST_DRAFT_COOKIE_NAME } from "@/lib/guest-order-drafts/security";
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

export default async function NewVirtualStagingOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; new?: string }>;
}) {
  const [user, params] = await Promise.all([getDashboardRequestUser(), searchParams]);
  const guestEntry = guestDraftsEnabled() && params.draft === undefined;
  // A client navigation may reuse the dashboard layout after its session expires.
  if (!user && guestEntry) redirect(GUEST_ENTRY);
  const { email, userId } = await requireOrderingClient(ORDER_ROUTE);
  const isQaPreview = user?.isQaPreview === true;
  const [media, welcomeOfferAvailability] = await Promise.all([
    getServiceOptionMediaByKeys(VIRTUAL_STAGING_MEDIA_KEYS),
    isQaPreview ? Promise.resolve(NO_WELCOME_OFFER_AVAILABLE) : getWelcomeOfferAvailability(userId),
  ]);
  const exampleMedia = Object.fromEntries(media);
  const accountForm = (
    <VirtualStagingOrderForm
      clientEmail={email}
      orderRoute={ORDER_ROUTE}
      exampleMediaByKey={exampleMedia}
      welcomeOfferAvailability={welcomeOfferAvailability}
    />
  );
  const recoverGuest =
    guestEntry && params.new !== "1" && (await cookies()).has(GUEST_DRAFT_COOKIE_NAME);
  return (
    <ClientDashboardLayout flush>
      {recoverGuest ? (
        <GuestVirtualStagingEntry signedIn exampleMediaByKey={exampleMedia}>
          {accountForm}
        </GuestVirtualStagingEntry>
      ) : (
        accountForm
      )}
    </ClientDashboardLayout>
  );
}
