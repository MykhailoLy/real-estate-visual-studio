// ============================================================
// /dashboard — main overview page
//
// Server component. Fetches real orders + client profile for
// the welcome heading, stats cards, next-steps panel, and the
// recent-jobs table.
//
// Security: email is read exclusively from the validated
// Supabase SSR session via getClientUser() — never from URL
// params, query strings, cookies, or any client input.
// ============================================================

import { redirect } from "next/navigation";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import {
  Briefcase,
  Clock,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  ArrowRight,
  Sparkles,
  CalendarClock,
  FileCheck2,
} from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import DashboardStatCard from "@/components/dashboard/DashboardStatCard";
import JobsTable from "@/components/dashboard/JobsTable";
import { getDashboardStats } from "@/lib/client-dashboard/mock-data";
import type { DashboardJob } from "@/lib/client-dashboard/mock-data";
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

export const metadata = {
  title: "Dashboard | PicchuSpot Client Portal",
};

// ── Next-steps panel ──────────────────────────────────────────

function getNextSteps(jobs: DashboardJob[]) {
  return [
    ...jobs
      .filter((j) => j.status === "awaiting-submission")
      .slice(0, 2)
      .map((j) => ({
        id: j.id,
        icon: Clock,
        iconBg: "bg-amber-50",
        iconColor: "text-amber-600",
        text: "Pending confirmation:",
        jobTitle: j.title,
        reference: j.reference,
        cta: "View job",
        ctaHref: "/dashboard/jobs",
      })),
    ...jobs
      .filter((j) => j.status === "in-progress")
      .slice(0, 1)
      .map((j) => ({
        id: j.id + "-prog",
        icon: CalendarClock,
        iconBg: "bg-blue-50",
        iconColor: "text-blue-600",
        text: "In production:",
        jobTitle: j.title,
        reference: j.reference,
        cta: "Track",
        ctaHref: "/dashboard/jobs",
      })),
    ...jobs
      .filter((j) => j.status === "completed")
      .slice(0, 1)
      .map((j) => ({
        id: j.id + "-done",
        icon: FileCheck2,
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-600",
        text: "Ready to download:",
        jobTitle: j.title,
        reference: j.reference,
        cta: "View files",
        ctaHref: "/dashboard/files",
      })),
  ].slice(0, 4);
}

// ── Page ──────────────────────────────────────────────────────

export default async function DashboardPage() {
  // Validated SSR session — email never comes from the client
  const [user, profile] = await Promise.all([
    getDashboardRequestUser(),
    getDashboardRequestProfile(),
  ]);

  // Onboarding gate (from PR #33): no profile row → redirect to onboarding
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

  const jobs     = mapOrdersToDashboardJobs(rawOrders, reviews);
  const hasJobs  = jobs.length > 0;
  const stats    = getDashboardStats(jobs);
  // DB query is already newest-first; take top 5 for the recent table
  const recentJobs  = jobs.slice(0, 5);
  const nextSteps   = getNextSteps(jobs);

  // Welcome name: profile first_name → full_name split → auth firstName → fallback
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

      {/* ── Welcome block ── */}
      <div className="mb-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark mb-2">
              Client Portal
            </p>
            <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
              Welcome back, {welcomeName}
            </h1>
            {companyLine && (
              <p className="text-muted mt-1.5 text-sm leading-relaxed">
                {companyLine}
              </p>
            )}
          </div>
          <ClientPortalLink
            href="/dashboard/orders/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors shadow-sm flex-shrink-0"
          >
            <PlusCircle className="w-4 h-4" aria-hidden />
            New Order
          </ClientPortalLink>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-7">
        <DashboardStatCard
          label="Active Jobs"
          value={stats.activeJobs}
          icon={Briefcase}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          accentBorder="border-l-blue-400"
          note="Currently in production"
        />
        <DashboardStatCard
          label="Awaiting"
          value={stats.awaitingSubmission}
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          accentBorder="border-l-amber-400"
          note={stats.awaitingSubmission > 0 ? "Pending confirmation" : "Nothing pending"}
        />
        <DashboardStatCard
          label="Completed"
          value={stats.completedJobs}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          accentBorder="border-l-emerald-400"
          note="All time"
        />
        <DashboardStatCard
          label="Revisions"
          value={stats.revisions}
          icon={RefreshCw}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
          accentBorder="border-l-orange-400"
          note={stats.revisions > 0 ? "Needs your feedback" : "None open"}
        />
      </div>

      {hasJobs ? (
        <>
          {/* ── Two-column row: Next steps + Recent jobs ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-7">

            {nextSteps.length > 0 && (
              <div className="xl:col-span-1">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-secondary" aria-hidden />
                  <h2 className="text-sm font-bold text-foreground">Next Steps</h2>
                </div>
                <div className="space-y-2">
                  {nextSteps.map((step) => (
                    <div
                      key={step.id}
                      className="bg-white border border-border rounded-xl p-4 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${step.iconBg}`}>
                        <step.icon className={`w-4 h-4 ${step.iconColor}`} aria-hidden />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted leading-snug">{step.text}</p>
                        <p className="text-[13px] font-semibold text-foreground leading-snug truncate">
                          {step.jobTitle}
                        </p>
                        <span className="inline-block text-[10px] text-muted font-mono bg-surface px-1.5 py-0.5 rounded mt-0.5">
                          {step.reference}
                        </span>
                      </div>
                      <ClientPortalLink
                        href={step.ctaHref}
                        className="flex-shrink-0 text-[11px] font-bold text-primary hover:text-primary-light transition-colors whitespace-nowrap"
                      >
                        {step.cta} →
                      </ClientPortalLink>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <section className={nextSteps.length > 0 ? "xl:col-span-2" : "xl:col-span-3"}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-foreground">Recent Jobs</h2>
                <ClientPortalLink
                  href="/dashboard/jobs"
                  className="text-[12px] font-bold text-primary hover:text-primary-light transition-colors flex items-center gap-1"
                >
                  View all
                  <ArrowRight className="w-3 h-3" aria-hidden />
                </ClientPortalLink>
              </div>
              <JobsTable jobs={recentJobs} limit={5} showProgress={false} />
            </section>
          </div>
        </>
      ) : (
        /* ── Getting-started card (no orders yet) ── */
        <div className="mb-7 bg-white border border-border rounded-2xl p-8 flex flex-col sm:flex-row sm:items-center gap-6 shadow-sm">
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary-dark mb-2">
              Getting started
            </p>
            <h2 className="text-xl font-bold text-foreground mb-2 leading-tight">
              No orders yet
            </h2>
            <p className="text-sm text-muted leading-relaxed max-w-md">
              Place your first order to get started. Virtual staging, floor plans,
              day-to-dusk, image enhancement and more — delivered within 24–48 hours.
            </p>
          </div>
          <ClientPortalLink
            href="/dashboard/orders/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors shadow-sm flex-shrink-0 whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" aria-hidden />
            Place your first order
          </ClientPortalLink>
        </div>
      )}

      {/* ── CTA banner ── */}
      <div className="relative overflow-hidden bg-primary rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" aria-hidden />
        <div className="absolute -bottom-8 right-24 w-32 h-32 rounded-full bg-secondary/10 pointer-events-none" aria-hidden />
        <div className="relative">
          <p className="text-secondary text-[11px] font-bold uppercase tracking-[0.2em] mb-1.5">
            Ready to get started?
          </p>
          <h2 className="text-xl font-bold text-white leading-tight mb-1">
            Place a new order today
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-md">
            Virtual staging, floor plans, day-to-dusk, image enhancement and more —
            delivered within 24–48 hours.
          </p>
        </div>
        <ClientPortalLink
          href="/dashboard/orders/new"
          className="relative inline-flex items-center gap-2 px-6 py-3 bg-secondary text-primary-dark font-bold rounded-xl hover:bg-secondary-light transition-colors text-sm whitespace-nowrap flex-shrink-0 shadow-sm"
        >
          <PlusCircle className="w-4 h-4" aria-hidden />
          Create a New Order
        </ClientPortalLink>
      </div>

    </ClientDashboardLayout>
  );
}
