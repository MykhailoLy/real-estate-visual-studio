import Link from "next/link";
import { BrandWordmark } from "@/components/brand";
import { RegionCurrencySelector } from "@/components/pricing/currency-client";
import { permanentRedirect } from "next/navigation";
import GuestVirtualStagingEntry from "@/components/order/virtual-staging/GuestVirtualStagingEntry";
import { VIRTUAL_STAGING_MEDIA_KEYS } from "@/data/order-options";
import { getDashboardRequestUser } from "@/lib/dashboard-request-context";
import { guestDraftsEnabled } from "@/lib/guest-order-drafts/entry";
import { VIRTUAL_STAGING_DRAFT_ROUTE } from "@/lib/order-drafts/virtual-staging";
import { getServiceOptionMediaByKeys } from "@/lib/site-media";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Virtual Staging Draft | PicchuSpot",
  robots: { index: false, follow: false },
};

export default async function VirtualStagingOrderPage() {
  if (!guestDraftsEnabled()) permanentRedirect(VIRTUAL_STAGING_DRAFT_ROUTE);
  const [user, media] = await Promise.all([
    getDashboardRequestUser(),
    getServiceOptionMediaByKeys(VIRTUAL_STAGING_MEDIA_KEYS),
  ]);
  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-border bg-white px-4 py-3 sm:px-8">
        <Link
          href="/"
          aria-label="PicchuSpot home"
          className="rounded focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <BrandWordmark className="text-xl" />
        </Link>
        <RegionCurrencySelector compact />
      </header>
      <main>
        <GuestVirtualStagingEntry
          signedIn={Boolean(user)}
          exampleMediaByKey={Object.fromEntries(media)}
        />
      </main>
    </>
  );
}
