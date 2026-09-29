// ============================================================
// /dashboard — operational client workspace.
//
// Server component. Fetches real orders + client profile for the
// welcome heading and activity rail, then streams portfolio-enriched
// service cards into the primary workspace.
//
// Security: email is read exclusively from the validated
// Supabase SSR session via getClientUser() — never from URL
// params, query strings, cookies, or any client input.
// ============================================================

import { Suspense } from "react";
import { Plus } from "lucide-react";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import DashboardActivityRail from "@/components/dashboard/DashboardActivityRail";
import DashboardResponsiveServices from "@/components/dashboard/DashboardResponsiveServices";
import {
  getDashboardRequestProfile,
  getDashboardRequestUser,
} from "@/lib/dashboard-request-context";
import {
  getOrdersForClient,
  mapOrdersToDashboardJobs,
} from "@/lib/client-orders";
import { getReviewsForClient } from "@/lib/client-reviews";
import { toOrderOwnership } from "@/lib/order-ownership";
import { getOrderCardImages } from "@/lib/order-card-media";
import { getOrderServiceExamples } from "@/lib/order-card-examples";
import {
  CLIENT_PORTAL_QA_COMPLETED_JOBS,
} from "@/lib/client-portal-qa-fixtures";
import {
  CLIENT_PORTAL_QA_WELCOME_OFFER_AVAILABILITY,
} from "@/lib/client-portal-qa";
import { getWelcomeOfferAvailability } from "@/lib/welcome-offer-server";
import { getPartnerClient } from "@/lib/account-pricing-server";

export const metadata = {
  title: "Dashboard | PicchuSpot Client Portal",
};

async function EnrichedDashboardServices() {
  const [images, examples] = await Promise.all([
    getOrderCardImages(),
    getOrderServiceExamples(),
  ]);

  return (
    <DashboardResponsiveServices
      images={Array.from(images.entries())}
      examples={Array.from(examples.entries())}
    />
  );
}

export default async function DashboardPage() {
  // Validated SSR session — email never comes from the client.
  const [user, profile] = await Promise.all([
    getDashboardRequestUser(),
    getDashboardRequestProfile(),
  ]);

  // Incomplete profiles are allowed in the portal. The order flow keeps the
  // minimum name requirement at its own boundary.

  // Fetch real orders only for a verified session. QA renders use fixed,
  // in-memory fixtures and never enter ownership-backed service-role reads.
  const ordersAndReviews = user?.email && !user.isQaPreview
    ? Promise.all([
        getOrdersForClient(toOrderOwnership(user)),
        getReviewsForClient(toOrderOwnership(user)),
      ])
    : Promise.resolve([[], []]);

  // The production view reads the existing authoritative redemption state.
  // A read failure is intentionally hidden, and preview never uses its fake
  // identity in that query.
  const welcomeOfferAvailability = user?.isQaPreview
    ? Promise.resolve(CLIENT_PORTAL_QA_WELCOME_OFFER_AVAILABILITY)
    : user
      ? getWelcomeOfferAvailability(user.id).catch(() => null)
      : Promise.resolve(null);

  const [[rawOrders, reviews], resolvedWelcomeOfferAvailability] =
    await Promise.all([ordersAndReviews, welcomeOfferAvailability]);

  const jobs = user?.isQaPreview
    ? [...CLIENT_PORTAL_QA_COMPLETED_JOBS]
    : mapOrdersToDashboardJobs(rawOrders, reviews);

  // Welcome name: profile first_name → full_name split → auth firstName → fallback.
  const welcomeName =
    profile?.first_name?.trim() ||
    (profile?.full_name?.trim()
      ? profile.full_name.trim().split(" ")[0]
      : null) ||
    user?.firstName ||
    "there";

  const companyLine = profile?.company_name?.trim() || null;
  const partnerClient = user && !user.isQaPreview
    ? await getPartnerClient(user.id).catch(() => null) : false;

  return (
    <ClientDashboardLayout>
      <header className="mb-7 border-b border-border pb-6 sm:mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold leading-tight text-primary sm:text-[28px]">
              Welcome back, {welcomeName}
            </h1>
            {companyLine && (
              <p className="mt-1.5 text-dashboard-body text-muted">
                {companyLine}
              </p>
            )}
            {partnerClient === true && (
              <p className="mt-2 text-dashboard-body text-primary">
                <span className="font-semibold">Partner pricing</span>
                {" · "}10% off eligible digital services.
              </p>
            )}
          </div>
          <ClientPortalLink
            href="/dashboard/orders/new"
            className="inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-dashboard-action font-bold text-white shadow-sm transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New Order
          </ClientPortalLink>
        </div>
      </header>

      <DashboardActivityRail
        jobs={jobs}
        isQaPreview={user?.isQaPreview === true}
        welcomeOfferAvailability={resolvedWelcomeOfferAvailability}
        services={
          <Suspense fallback={<DashboardResponsiveServices />}>
            <EnrichedDashboardServices />
          </Suspense>
        }
      />
    </ClientDashboardLayout>
  );
}
