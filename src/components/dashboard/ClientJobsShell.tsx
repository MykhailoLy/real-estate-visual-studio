"use client";

// ============================================================
// ClientJobsShell
//
// Thin "use client" shell for /dashboard/jobs.
// Owns the status-filter useState so the outer page can stay
// a server component that fetches real orders server-side.
//
// Receives DashboardJob[] as a serialisable prop — no Supabase
// calls happen here.
// ============================================================

import { useState } from "react";
import ClientPortalLink from "./ClientPortalLink";
import { PlusCircle, PackageOpen } from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import ClientJobsStatusFilters from "@/components/dashboard/ClientJobsStatusFilters";
import JobsTable from "@/components/dashboard/JobsTable";
import JobsWorkspaceRail from "@/components/dashboard/JobsWorkspaceRail";
import type { DashboardJob, DashboardJobStatus } from "@/lib/client-dashboard/mock-data";

interface ClientJobsShellProps {
  jobs: DashboardJob[];
}

export default function ClientJobsShell({ jobs }: ClientJobsShellProps) {
  const [statusFilter, setStatusFilter] = useState<
    DashboardJobStatus | "all"
  >("all");

  const hasJobs = jobs.length > 0;

  return (
    <ClientDashboardLayout>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark">
            Client Portal
          </p>
          <h1 className="text-2xl font-bold leading-tight text-primary sm:text-[28px]">
            Jobs
          </h1>
          <p className="mt-1 text-sm text-muted">
            Track every order from production through delivery.
          </p>
        </div>
        <ClientPortalLink
          href="/dashboard/orders/new"
          className="inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <PlusCircle className="h-4 w-4" aria-hidden />
          New Order
        </ClientPortalLink>
      </header>

      <div
        data-jobs-workspace
        className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]"
      >
        <JobsWorkspaceRail jobs={jobs} />

        <section
          data-all-jobs-workspace
          aria-labelledby="all-jobs-heading"
          className="min-w-0"
        >
          <div className="mb-4 border-b border-border pb-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2
                  id="all-jobs-heading"
                  className="text-lg font-bold text-primary"
                >
                  All jobs
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Submitted orders remain separate from saved drafts.
                </p>
              </div>
              <p className="text-xs font-semibold text-muted">
                {jobs.length} submitted {jobs.length === 1 ? "order" : "orders"}
              </p>
            </div>
          </div>

          {hasJobs ? (
            <>
              <ClientJobsStatusFilters
                activeStatusFilter={statusFilter}
                onStatusFilter={setStatusFilter}
              />

              <JobsTable
                jobs={jobs}
                showControls
                showStatusControl={false}
                externalStatusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                showProgress
              />
            </>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-border bg-white px-5 py-10 text-center shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface">
                <PackageOpen
                  className="h-5 w-5 text-muted-light"
                  aria-hidden
                />
              </div>
              <h3 className="text-base font-bold text-foreground">
                No submitted jobs yet
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
                Submit a new order when you are ready. Saved drafts remain in
                the working rail until they are finished.
              </p>
              <ClientPortalLink
                href="/dashboard/orders/new"
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <PlusCircle className="h-4 w-4" aria-hidden />
                Start a new order
              </ClientPortalLink>
            </div>
          )}
        </section>
      </div>
    </ClientDashboardLayout>
  );
}
