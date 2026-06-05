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
import Link from "next/link";
import { PlusCircle, PackageOpen } from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import JobsTable from "@/components/dashboard/JobsTable";
import { getDashboardStats } from "@/lib/client-dashboard/mock-data";
import type { DashboardJob, DashboardJobStatus } from "@/lib/client-dashboard/mock-data";

interface ClientJobsShellProps {
  jobs: DashboardJob[];
}

export default function ClientJobsShell({ jobs }: ClientJobsShellProps) {
  const [statusFilter, setStatusFilter] = useState<DashboardJobStatus | "all">("all");

  const stats    = getDashboardStats(jobs);
  const hasJobs  = jobs.length > 0;

  return (
    <ClientDashboardLayout
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
    >
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark mb-1.5">
            Client Portal
          </p>
          <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
            Jobs
          </h1>
          <p className="text-muted mt-1 text-sm">
            Track every order from production through delivery.
          </p>
        </div>
        <Link
          href="/order"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors shadow-sm flex-shrink-0"
        >
          <PlusCircle className="w-4 h-4" aria-hidden />
          New Order
        </Link>
      </div>

      {hasJobs ? (
        <>
          {/* ── Status summary chips ── */}
          <div className="flex flex-wrap gap-2 mb-5">
            {[
              { value: "all" as const,                 label: `All (${jobs.length})` },
              { value: "in-progress" as const,         label: `Active (${stats.activeJobs})` },
              { value: "awaiting-submission" as const, label: `Awaiting (${stats.awaitingSubmission})` },
              { value: "completed" as const,           label: `Completed (${stats.completedJobs})` },
            ]
              // Always show "All"; only show other chips when count > 0
              .filter((c) => c.value === "all" ||
                (c.value === "in-progress"         && stats.activeJobs > 0)         ||
                (c.value === "awaiting-submission" && stats.awaitingSubmission > 0) ||
                (c.value === "completed"           && stats.completedJobs > 0)
              )
              .map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setStatusFilter(chip.value)}
                  className={
                    statusFilter === chip.value
                      ? "inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-bold bg-primary text-white shadow-sm transition-all"
                      : "inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-semibold bg-white border border-border text-foreground/70 hover:border-primary/40 hover:text-primary transition-all"
                  }
                >
                  {chip.label}
                </button>
              ))}
          </div>

          {/* ── Jobs table with search + filter ── */}
          <JobsTable
            jobs={jobs}
            showControls
            externalStatusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            showProgress
          />
        </>
      ) : (
        /* ── Empty state ── */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-5 shadow-sm">
            <PackageOpen className="w-7 h-7 text-muted-light" aria-hidden />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">No orders yet</h2>
          <p className="text-sm text-muted max-w-sm leading-relaxed mb-6">
            Place your first order and it will appear here with delivery,
            revision, and file status updates.
          </p>
          <Link
            href="/order"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" aria-hidden />
            Place your first order
          </Link>
        </div>
      )}
    </ClientDashboardLayout>
  );
}
