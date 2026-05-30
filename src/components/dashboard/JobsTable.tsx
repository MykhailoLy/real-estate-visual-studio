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
  /** Whether to show the progress bar column. Default true. */
  showProgress?: boolean;
  className?: string;
}

const ALL_STATUSES: DashboardJobStatus[] = [
  "awaiting-submission",
  "in-progress",
  "revision-requested",
  "completed",
  "cancelled",
];

/** Progress bar — coloured by job status */
function ProgressBar({ value, status }: { value: number; status: DashboardJobStatus }) {
  const trackColor = "bg-border";
  const fillColor =
    status === "completed"
      ? "bg-emerald-500"
      : status === "in-progress"
      ? "bg-blue-500"
      : status === "revision-requested"
      ? "bg-orange-400"
      : status === "awaiting-submission"
      ? "bg-amber-400"
      : "bg-slate-300";

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div
        className={cn("flex-1 h-1.5 rounded-full overflow-hidden", trackColor)}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress: ${value}%`}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-300", fillColor)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-muted w-7 text-right flex-shrink-0">
        {value}%
      </span>
    </div>
  );
}

export default function JobsTable({
  jobs,
  showControls = false,
  limit,
  externalStatusFilter,
  onStatusFilterChange,
  showProgress = true,
  className,
}: JobsTableProps) {
  const [search, setSearch] = useState("");
  const [internalStatusFilter, setInternalStatusFilter] = useState<
    DashboardJobStatus | "all"
  >("all");

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

  // Columns: Job | Service | Progress | Status | Est. Completion | Cost
  // Progress + Est. Completion are hidden on small screens for readability
  const colCount = showProgress ? 6 : 5;

  return (
    <div className={cn("space-y-3", className)}>
      {showControls && (
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light pointer-events-none"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Search by title, reference, or service…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-lg bg-white placeholder:text-muted-light focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
          </div>

          {/* Status filter */}
          <div className="relative flex-shrink-0">
            <SlidersHorizontal
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light pointer-events-none"
              aria-hidden
            />
            <select
              value={statusFilter}
              onChange={(e) =>
                handleStatusFilterChange(e.target.value as DashboardJobStatus | "all")
              }
              className="w-full sm:w-auto pl-9 pr-8 py-2.5 text-sm border border-border rounded-lg bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors cursor-pointer text-foreground"
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

      {/* Results summary */}
      {showControls && (
        <p className="text-[11px] text-muted">
          {displayed.length === 0
            ? "No jobs match your filters"
            : `Showing ${displayed.length} of ${jobs.length} job${jobs.length !== 1 ? "s" : ""}`}
          {statusFilter !== "all" && ` · filtered by ${STATUS_LABELS[statusFilter as DashboardJobStatus]}`}
        </p>
      )}

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: showProgress ? "720px" : "580px" }}>
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light">
                  Job
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light hidden md:table-cell">
                  Service
                </th>
                {showProgress && (
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light hidden lg:table-cell w-36">
                    Progress
                  </th>
                )}
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light hidden xl:table-cell">
                  Est. Completion
                </th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center">
                        <FileX className="w-5 h-5 text-muted-light" aria-hidden />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">No jobs found</p>
                        <p className="text-xs text-muted mt-1">
                          {search || statusFilter !== "all"
                            ? "Try adjusting your search or filter."
                            : "Your jobs will appear here once you place an order."}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                displayed.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-surface/50 transition-colors group"
                  >
                    {/* Job title + reference */}
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-foreground group-hover:text-primary transition-colors leading-snug text-[13px]">
                        {job.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted font-mono bg-surface px-1.5 py-0.5 rounded">
                          {job.reference}
                        </span>
                        <span className="text-[10px] text-muted-light hidden sm:inline">
                          {job.imageCount} image{job.imageCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </td>
                    {/* Service */}
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-[13px] text-foreground/70">{job.serviceType}</span>
                    </td>
                    {/* Progress bar */}
                    {showProgress && (
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <ProgressBar value={job.progress} status={job.status} />
                      </td>
                    )}
                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <StatusBadge status={job.status} />
                      {/* Show progress inline on small screens where the column is hidden */}
                      {showProgress && (
                        <div className="mt-1.5 lg:hidden">
                          <ProgressBar value={job.progress} status={job.status} />
                        </div>
                      )}
                    </td>
                    {/* Est. completion */}
                    <td className="px-4 py-3.5 hidden xl:table-cell text-[13px] text-foreground/65">
                      {formatDate(job.estimatedCompletion)}
                    </td>
                    {/* Cost */}
                    <td className="px-4 py-3.5 text-right font-bold text-foreground tabular-nums text-[13px]">
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
        <div className="text-center pt-1">
          <Link
            href="/dashboard/jobs"
            className="text-sm font-semibold text-primary hover:text-primary-light transition-colors inline-flex items-center gap-1"
          >
            View all {filtered.length} jobs
            <span aria-hidden>→</span>
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
