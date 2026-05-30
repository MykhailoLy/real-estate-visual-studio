"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, SlidersHorizontal, FileX } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/utils";
import type {
  DashboardJob,
  DashboardJobStatus,
} from "@/lib/client-dashboard/mock-data";
import { STATUS_LABELS } from "@/lib/client-dashboard/mock-data";
import StatusBadge from "./StatusBadge";

interface JobsTableProps {
  jobs: DashboardJob[];
  /** If true, shows search + status filter controls above the table. */
  showControls?: boolean;
  /** Limit rows (used on the overview page to show "recent" only). */
  limit?: number;
  /**
   * Externally controlled status filter (e.g. driven by the sidebar).
   * When provided, the table's own select stays in sync with this value.
   */
  externalStatusFilter?: DashboardJobStatus | "all";
  /** Called when the table's own select changes — lets the parent sync sidebar. */
  onStatusFilterChange?: (status: DashboardJobStatus | "all") => void;
  className?: string;
}

const ALL_STATUSES: DashboardJobStatus[] = [
  "awaiting-submission",
  "in-progress",
  "revision-requested",
  "completed",
  "cancelled",
];

export default function JobsTable({
  jobs,
  showControls = false,
  limit,
  externalStatusFilter,
  onStatusFilterChange,
  className,
}: JobsTableProps) {
  const [search, setSearch] = useState("");
  // Internal filter state — used only when no external filter is provided.
  const [internalStatusFilter, setInternalStatusFilter] = useState<
    DashboardJobStatus | "all"
  >("all");

  // If an external filter is wired in, use that; otherwise fall back to internal.
  const isControlled = externalStatusFilter !== undefined;
  const statusFilter = isControlled ? externalStatusFilter : internalStatusFilter;

  function handleStatusFilterChange(value: DashboardJobStatus | "all") {
    if (isControlled) {
      onStatusFilterChange?.(value);
    } else {
      setInternalStatusFilter(value);
    }
  }

  const filtered = jobs.filter((job) => {
    const matchesSearch =
      search === "" ||
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.reference.toLowerCase().includes(search.toLowerCase()) ||
      job.serviceType.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const displayed = limit ? filtered.slice(0, limit) : filtered;

  return (
    <div className={cn("space-y-4", className)}>
      {showControls && (
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Search by title, reference, or service…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-lg bg-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <SlidersHorizontal
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
              aria-hidden
            />
            <select
              value={statusFilter}
              onChange={(e) =>
                handleStatusFilterChange(e.target.value as DashboardJobStatus | "all")
              }
              className="pl-9 pr-8 py-2.5 text-sm border border-border rounded-lg bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer"
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Table wrapper with horizontal scroll on small screens */}
      <div className="border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Job
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted hidden md:table-cell">
                  Service
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted hidden lg:table-cell">
                  Est. Completion
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted">
                      <FileX className="w-8 h-8 text-muted-light" aria-hidden />
                      <p className="text-sm font-medium">No jobs found</p>
                      {search || statusFilter !== "all" ? (
                        <p className="text-xs">
                          Try adjusting your search or filter.
                        </p>
                      ) : (
                        <p className="text-xs">
                          Your jobs will appear here once you place an order.
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayed.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-surface/60 transition-colors group"
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
                        {job.title}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5 font-mono">
                        {job.reference}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-foreground/75">{job.serviceType}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell text-foreground/70">
                      {formatDate(job.estimatedCompletion)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-foreground tabular-nums">
                      {formatUSD(job.costCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {limit && filtered.length > limit && (
        <div className="text-center">
          <Link
            href="/dashboard/jobs"
            className="text-sm font-semibold text-primary hover:text-primary-light transition-colors"
          >
            View all {filtered.length} jobs →
          </Link>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
