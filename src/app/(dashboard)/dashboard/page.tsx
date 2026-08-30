// ============================================================
// /dashboard — operational client workspace.
//
// Server component. Fetches real orders + client profile for the
// welcome heading, compact stats, activity rail, and quick-start
// service launcher.
//
// Security: email is read exclusively from the validated
// Supabase SSR session via getClientUser() — never from URL
// params, query strings, cookies, or any client input.
// ============================================================

import { redirect } from "next/navigation";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  PlusCircle,
  RefreshCw,
} from "lucide-react";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import DashboardActivityRail from "@/components/dashboard/DashboardActivityRail";
import DashboardQuickStart from "@/components/dashboard/DashboardQuickStart";
import DashboardStatCard from "@/components/dashboard/DashboardStatCard";
import { getDashboardStats } from "@/lib/client-dashboard/mock-data";
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

export const metadata = {
  title: "Dashboard | PicchuSpot Client Portal",
};

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
  const stats = getDashboardStats(jobs);
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
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark">
              Client Portal
            </p>
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
            className="inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <PlusCircle className="h-4 w-4" aria-hidden />
            New Order
          </ClientPortalLink>
        </div>
      </header>

      <section aria-label="Job summary" className="mb-6">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <DashboardStatCard
            label="Active Jobs"
            value={stats.activeJobs}
            icon={Briefcase}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
            accentBorder="border-l-blue-400"
            note="Currently in production"
            compact
            className="shadow-none hover:translate-y-0 hover:shadow-sm"
          />
          <DashboardStatCard
            label="Awaiting"
            value={stats.awaitingSubmission}
            icon={Clock}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
            accentBorder="border-l-amber-400"
            note={
              stats.awaitingSubmission > 0
                ? "Pending confirmation"
                : "Nothing pending"
            }
            compact
            className="shadow-none hover:translate-y-0 hover:shadow-sm"
          />
          <DashboardStatCard
            label="Completed"
            value={stats.completedJobs}
            icon={CheckCircle2}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
            accentBorder="border-l-emerald-400"
            note="All time"
            compact
            className="shadow-none hover:translate-y-0 hover:shadow-sm"
          />
          <DashboardStatCard
            label="Revisions"
            value={stats.revisions}
            icon={RefreshCw}
            iconColor="text-orange-600"
            iconBg="bg-orange-50"
            accentBorder="border-l-orange-400"
            note={stats.revisions > 0 ? "Needs your feedback" : "None open"}
            compact
            className="shadow-none hover:translate-y-0 hover:shadow-sm"
          />
        </div>
      </section>

      <div
        data-dashboard-workspace
        className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]"
      >
        <DashboardActivityRail jobs={jobs} />
        <div className="min-w-0">
          <DashboardQuickStart
            services={services}
            isFirstOrder={jobs.length === 0}
          />
        </div>
      </div>
    </ClientDashboardLayout>
  );
}
