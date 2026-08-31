"use client";

import ClientPortalLink from "./ClientPortalLink";
import { useState } from "react";
import { Search, SlidersHorizontal, FileX } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatStoredMoney } from "@/lib/pricing/format";
import type {
  DashboardJob,
  DashboardJobStatus,
} from "@/lib/client-dashboard/mock-data";
import { STATUS_LABELS } from "@/lib/client-dashboard/mock-data";
import {
  filterDashboardJobs,
  getDistinctJobSecondaryLabel,
} from "./job-workspace";
import StatusBadge from "./StatusBadge";

interface JobsTableProps {
  jobs: DashboardJob[];
  /** If true, shows search + status filter controls above the table. */
  showControls?: boolean;
  /** Keep the status select when another page-level status toolbar is absent. */
  showStatusControl?: boolean;
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
  "pending-rework",
  "rework-in-progress",
  "new-version-ready",
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
      : [
          "revision-requested",
          "pending-rework",
          "rework-in-progress",
          "new-version-ready",
        ].includes(status)
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
  showStatusControl = true,
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

  const filtered = filterDashboardJobs(jobs, search, statusFilter);

  const displayed = limit ? filtered.slice(0, limit) : filtered;

  const colCount = showProgress ? 8 : 7;

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
              placeholder="Search by title, reference or service..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-4 text-sm transition-colors placeholder:text-muted-light focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Status filter */}
          {showStatusControl && <div className="relative flex-shrink-0">
            <SlidersHorizontal
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light pointer-events-none"
              aria-hidden
            />
            <select
              value={statusFilter}
              onChange={(e) =>
                handleStatusFilterChange(e.target.value as DashboardJobStatus | "all")
              }
              className="min-h-11 w-full cursor-pointer appearance-none rounded-lg border border-border bg-white py-2.5 pl-9 pr-8 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-auto"
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>}
        </div>
      )}

      {/* Results summary */}
      {showControls && (
        <p className="text-[11px] text-muted" aria-live="polite">
          {displayed.length === 0
            ? "No jobs match your search or filters"
            : `Showing ${displayed.length} of ${jobs.length} job${jobs.length !== 1 ? "s" : ""}`}
          {statusFilter !== "all" && ` · filtered by ${STATUS_LABELS[statusFilter as DashboardJobStatus]}`}
        </p>
      )}

      <div
        data-mobile-jobs-list
        className="overflow-hidden rounded-xl border border-border bg-white shadow-sm lg:hidden"
      >
        {displayed.length === 0 ? (
          <div className="px-4 py-10">
            <EmptyJobsMessage
              isFiltered={Boolean(search || statusFilter !== "all")}
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {displayed.map((job) => (
              <MobileJobRow
                key={job.id}
                job={job}
                showProgress={showProgress}
              />
            ))}
          </ul>
        )}
      </div>

      <div
        data-desktop-jobs-table
        className="hidden overflow-x-auto rounded-xl border border-border bg-white shadow-sm lg:block"
        tabIndex={0}
      >
        <table className="min-w-[960px] w-full table-fixed text-sm">
          <caption className="sr-only">All submitted jobs</caption>
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="w-40 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light">
                Job title
              </th>
              <th className="w-24 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light">
                Job reference
              </th>
              <th className="w-32 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light">
                Status
              </th>
              <th className="w-24 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light">
                Job submitted
              </th>
              <th className="w-24 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light">
                Job complete
              </th>
              <th className="w-32 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light">
                Job type
              </th>
              <th className="w-20 px-3 py-3 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light">
                Job cost
              </th>
              {showProgress && (
                <th className="w-28 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light">
                  Progress
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-12 text-center">
                  <EmptyJobsMessage
                    isFiltered={Boolean(search || statusFilter !== "all")}
                  />
                </td>
              </tr>
            ) : (
              displayed.map((job) => (
                <tr
                  key={job.id}
                  className="group transition-colors hover:bg-surface/50"
                >
                  <td className="px-3 py-3.5 align-top">
                    <ClientPortalLink
                      href={`/dashboard/jobs/${job.id}`}
                      className="group/link inline-flex min-h-11 max-w-full flex-col justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <span className="line-clamp-2 break-words text-[13px] font-semibold leading-snug text-foreground transition-colors group-hover/link:text-primary">
                        {job.title}
                      </span>
                      <JobSecondaryLabel
                        job={job}
                        className="mt-0.5 line-clamp-1 break-words text-[11px] text-muted"
                      />
                    </ClientPortalLink>
                  </td>
                  <td className="px-3 py-3.5 align-top">
                    <span className="block truncate rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
                      {job.reference}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 align-top">
                    <StatusBadge status={job.status} compact />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 align-top text-[12px] text-foreground/70">
                    {formatDate(job.submittedDate)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 align-top text-[12px] text-foreground/70">
                    {formatDate(job.estimatedCompletion)}
                  </td>
                  <td className="break-words px-3 py-3.5 align-top text-[13px] leading-snug text-foreground/70">
                    {job.serviceType}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-right align-top text-[13px] font-bold tabular-nums text-foreground">
                    {formatStoredMoney(job.costCents, job.currency)}
                  </td>
                  {showProgress && (
                    <td className="px-3 py-3.5 align-top">
                      <ProgressBar value={job.progress} status={job.status} />
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {limit && filtered.length > limit && (
        <div className="text-center pt-1">
          <ClientPortalLink
            href="/dashboard/jobs"
            className="text-sm font-semibold text-primary hover:text-primary-light transition-colors inline-flex items-center gap-1"
          >
            View all {filtered.length} jobs
            <span aria-hidden>→</span>
          </ClientPortalLink>
        </div>
      )}
    </div>
  );
}

function MobileJobRow({
  job,
  showProgress,
}: {
  job: DashboardJob;
  showProgress: boolean;
}) {
  const estimatedCompletion = formatDate(job.estimatedCompletion);
  const showEstimatedCompletion =
    estimatedCompletion !== "—" && estimatedCompletion !== "Delivered";

  return (
    <li>
      <article>
        <ClientPortalLink
          href={`/dashboard/jobs/${job.id}`}
          aria-label={`Open ${job.title}, ${job.reference}`}
          className="group block min-h-11 p-4 transition-colors hover:bg-surface/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="line-clamp-2 break-words text-sm font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
                {job.title}
              </span>
              <JobSecondaryLabel
                job={job}
                className="mt-0.5 line-clamp-1 break-words text-xs text-muted"
              />
            </div>
            <StatusBadge status={job.status} compact />
          </div>

          <span className="mt-2 block w-fit max-w-full truncate rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
            {job.reference}
          </span>
          <span className="mt-2 line-clamp-2 break-words text-xs leading-relaxed text-foreground/70">
            {job.serviceType}
          </span>

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
            <span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light">
                Cost
              </span>
              <span className="mt-0.5 block whitespace-nowrap font-bold tabular-nums text-foreground">
                {formatStoredMoney(job.costCents, job.currency)}
              </span>
            </span>
            {showEstimatedCompletion && (
              <span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light">
                  Estimated
                </span>
                <span className="mt-0.5 block text-foreground/70">
                  {estimatedCompletion}
                </span>
              </span>
            )}
          </div>

          {showProgress && (
            <div className="mt-3">
              <ProgressBar value={job.progress} status={job.status} />
            </div>
          )}
        </ClientPortalLink>
      </article>
    </li>
  );
}

function JobSecondaryLabel({
  job,
  className,
}: {
  job: DashboardJob;
  className: string;
}) {
  const secondaryLabel = getDistinctJobSecondaryLabel(job);

  if (!secondaryLabel) return null;

  return <span className={className}>{secondaryLabel}</span>;
}

function EmptyJobsMessage({ isFiltered }: { isFiltered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface">
        <FileX className="h-5 w-5 text-muted-light" aria-hidden />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">No jobs found</p>
        <p className="mt-1 text-xs text-muted">
          {isFiltered
            ? "Try adjusting your search or filter."
            : "Your jobs will appear here once you place an order."}
        </p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  // Pass through display strings produced for real orders ("Delivered", "—")
  // and guard against empty / invalid values.
  if (!iso || iso === "—" || iso === "Delivered") return iso || "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
