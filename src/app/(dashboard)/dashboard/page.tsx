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

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import DashboardActivityRail from "@/components/dashboard/DashboardActivityRail";
import DashboardQuickStart from "@/components/dashboard/DashboardQuickStart";
import {
  getDashboardRequestProfile,
  getDashboardRequestUser,
} from "@/lib/dashboard-request-context";
import {
  getOrdersForClient,
  mapOrdersToDashboardJobs,
} from "@/lib/client-orders";
import { getReviewsForClient } from "@/lib/client-reviews";
import { getOrderServiceCards } from "@/lib/order-services";
import { toOrderOwnership } from "@/lib/order-ownership";
import { getOrderCardImages } from "@/lib/order-card-media";
import { getOrderServiceExamples } from "@/lib/order-card-examples";

export const metadata = {
  title: "Dashboard | PicchuSpot Client Portal",
};

async function EnrichedDashboardQuickStart({
  services,
}: {
  services: ReturnType<typeof getOrderServiceCards>;
}) {
  const [images, examples] = await Promise.all([
    getOrderCardImages(),
    getOrderServiceExamples(),
  ]);

  return (
    <DashboardQuickStart
      services={services}
      images={images}
      examples={examples}
    />
  );
}

export default async function DashboardPage() {
  // Validated SSR session — email never comes from the client.
  const [user, profile] = await Promise.all([
    getDashboardRequestUser(),
    getDashboardRequestProfile(),
  ]);

  // Onboarding gate (from PR #33): no profile row → redirect to onboarding.
  if (user && profile === null) {
    redirect("/dashboard/profile?onboarding=1");
  }

  // Fetch real orders. Returns [] on missing env vars or any error.
  const [rawOrders, reviews] = user?.email
    ? await Promise.all([
        getOrdersForClient(toOrderOwnership(user)),
        getReviewsForClient(toOrderOwnership(user)),
      ])
    : [[], []];

  const jobs = mapOrdersToDashboardJobs(rawOrders, reviews);
  const services = getOrderServiceCards();

  // Welcome name: profile first_name → full_name split → auth firstName → fallback.
  const welcomeName =
    profile?.first_name?.trim() ||
    (profile?.full_name?.trim()
      ? profile.full_name.trim().split(" ")[0]
      : null) ||
    user?.firstName ||
    "there";

  const companyLine = profile?.company_name?.trim() || null;

  return (
    <ClientDashboardLayout>
      <header className="mb-7 border-b border-border pb-6 sm:mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold leading-tight text-primary sm:text-[28px]">
              Welcome back, {welcomeName}
            </h1>
            {companyLine && (
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {companyLine}
              </p>
            )}
          </div>
          <ClientPortalLink
            href="/dashboard/orders/new"
            className="inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New Order
          </ClientPortalLink>
        </div>
      </header>

      <DashboardActivityRail
        jobs={jobs}
        services={
          <Suspense fallback={<DashboardQuickStart services={services} />}>
            <EnrichedDashboardQuickStart services={services} />
          </Suspense>
        }
      />
    </ClientDashboardLayout>
  );
}
