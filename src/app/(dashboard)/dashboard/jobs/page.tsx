"use client";

import { useState } from "react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import JobsTable from "@/components/dashboard/JobsTable";
import { MOCK_JOBS } from "@/lib/client-dashboard/mock-data";
import type { DashboardJobStatus } from "@/lib/client-dashboard/mock-data";

// NOTE: This page is a client component so it can own the shared
// statusFilter state that drives both the sidebar/mobile filters
// (via ClientDashboardLayout) and the JobsTable select (via props).
// Sidebar ↔ table select are always in sync.

export default function DashboardJobsPage() {
  const [statusFilter, setStatusFilter] = useState<DashboardJobStatus | "all">(
    "all"
  );

  return (
    <ClientDashboardLayout
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
    >
      {/* Page header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary-dark mb-1">
          Client Portal
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary leading-tight">
          Jobs
        </h1>
        <p className="text-muted mt-1 text-sm">
          All your orders and their current status.
        </p>
      </div>

      {/* Jobs table — externalStatusFilter keeps it in sync with sidebar/mobile filters */}
      <JobsTable
        jobs={MOCK_JOBS}
        showControls
        externalStatusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />
    </ClientDashboardLayout>
  );
}
