"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import JobsTable from "@/components/dashboard/JobsTable";
import { MOCK_JOBS, getDashboardStats } from "@/lib/client-dashboard/mock-data";
import type { DashboardJobStatus } from "@/lib/client-dashboard/mock-data";

export default function DashboardJobsPage() {
  const [statusFilter, setStatusFilter] = useState<DashboardJobStatus | "all">("all");

  const stats = getDashboardStats(MOCK_JOBS);

  return (
    <ClientDashboardLayout
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
    >
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark mb-1.5">
            Client Portal
          </p>
          <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
            Jobs
          </h1>
          <p className="text-muted mt-1 text-sm">
            All your orders and their current status.
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

      {/* Status summary chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { value: "all" as const, label: `All (${MOCK_JOBS.length})` },
          { value: "in-progress" as const, label: `Active (${stats.activeJobs})` },
          { value: "awaiting-submission" as const, label: `Awaiting (${stats.awaitingSubmission})` },
          { value: "revision-requested" as const, label: `Revisions (${stats.revisions})` },
          { value: "completed" as const, label: `Completed (${stats.completedJobs})` },
        ].map((chip) => (
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

      {/* Jobs table with search + filter synced to sidebar */}
      <JobsTable
        jobs={MOCK_JOBS}
        showControls
        externalStatusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        showProgress
      />
    </ClientDashboardLayout>
  );
}
