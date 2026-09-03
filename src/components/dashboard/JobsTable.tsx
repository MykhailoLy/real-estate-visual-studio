"use client";

import ClientPortalLink from "./ClientPortalLink";
import { useRouter } from "next/navigation";
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

// DashboardJob has no authoritative completion timestamp. An ETA must never
// be displayed as though the job were actually complete.
const JOB_COMPLETE_VALUE = "—";

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
      <span data-dashboard-metadata className="w-9 flex-shrink-0 text-right text-dashboard-metadata tabular-nums text-foreground">
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
              className="min-h-11 w-full rounded-lg border border-border bg-white py-2.5 pl-9 pr-4 text-dashboard-mobile-control transition-colors placeholder:text-muted-light focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 md:text-sm"
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
              className="min-h-11 w-full cursor-pointer appearance-none rounded-lg border border-border bg-white py-2.5 pl-9 pr-8 text-dashboard-mobile-control text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-auto md:text-sm"
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
        <p data-dashboard-metadata className="text-dashboard-metadata text-muted" aria-live="polite">
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
        <table className="min-w-[1200px] w-full table-fixed text-dashboard-action">
          <caption className="sr-only">All submitted jobs</caption>
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[15%]" />
            <col className="w-[8%]" />
            {showProgress && <col className="w-[11%]" />}
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="align-middle px-4 py-3 text-left text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-secondary-dark">
                Job title
              </th>
              <th className="align-middle px-4 py-3 text-left text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-secondary-dark">
                Job reference
              </th>
              <th className="align-middle px-4 py-3 text-left text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-secondary-dark">
                Status
              </th>
              <th className="align-middle px-4 py-3 text-left text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-secondary-dark">
                Job submitted
              </th>
              <th className="align-middle px-4 py-3 text-left text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-secondary-dark">
                Job complete
              </th>
              <th className="align-middle px-4 py-3 text-left text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-secondary-dark">
                Job type
              </th>
              <th className="align-middle px-4 py-3 text-right text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-secondary-dark">
                Job cost
              </th>
              {showProgress && (
                <th className="align-middle px-4 py-3 text-left text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-secondary-dark">
                  Progress
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="align-middle px-4 py-12 text-center">
                  <EmptyJobsMessage
                    isFiltered={Boolean(search || statusFilter !== "all")}
                  />
                </td>
              </tr>
            ) : (
              displayed.map((job) => (
                <DesktopJobRow
                  key={job.id}
                  job={job}
                  showProgress={showProgress}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {limit && filtered.length > limit && (
        <div className="text-center pt-1">
          <ClientPortalLink
            href="/dashboard/jobs"
            className="inline-flex items-center gap-1 text-dashboard-action font-semibold text-primary transition-colors hover:text-primary-light"
          >
            View all {filtered.length} jobs
            <span aria-hidden>→</span>
          </ClientPortalLink>
        </div>
      )}
    </div>
  );
}

function DesktopJobRow({
  job,
  showProgress,
}: {
  job: DashboardJob;
  showProgress: boolean;
}) {
  const router = useRouter();
  const jobHref = `/dashboard/jobs/${job.id}`;

  function handleRowClick(event: React.MouseEvent<HTMLTableRowElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      isInteractiveTarget(event.target)
    ) {
      return;
    }

    router.push(jobHref);
  }

  return (
    <tr
      onClick={handleRowClick}
      className="dashboard-pointer-hover group cursor-pointer transition-colors active:bg-ivory"
    >
      <td className="align-middle px-4 py-3.5">
        <ClientPortalLink
          href={jobHref}
          className="group/link inline-flex min-h-11 max-w-full flex-col justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <span data-dashboard-critical-title className="dashboard-pointer-hover-title inline-block line-clamp-2 break-words text-dashboard-action font-bold leading-snug text-primary transition-colors group-focus-visible/link:text-primary-light">
            {job.title}
          </span>
          <JobSecondaryLabel
            job={job}
            className="mt-0.5 line-clamp-2 break-words text-dashboard-metadata text-muted"
          />
        </ClientPortalLink>
      </td>
      <td className="align-middle px-4 py-3.5">
        <span data-dashboard-metadata title={job.reference} className="block w-fit max-w-full truncate rounded-md bg-primary/8 px-2 py-1 font-mono text-dashboard-metadata font-semibold text-primary">
          {job.reference}
        </span>
      </td>
      <td className="align-middle px-4 py-3.5">
        <StatusBadge status={job.status} compact />
      </td>
      <td data-dashboard-metadata className="align-middle whitespace-nowrap px-4 py-3.5 text-dashboard-metadata font-medium text-foreground">
        {formatDate(job.submittedDate)}
      </td>
      <td data-dashboard-metadata className="align-middle whitespace-nowrap px-4 py-3.5 text-dashboard-metadata font-medium text-muted">
        {JOB_COMPLETE_VALUE}
      </td>
      <td data-dashboard-metadata className="align-middle break-words px-4 py-3.5 text-dashboard-metadata font-medium leading-snug text-foreground">
        {job.serviceType}
      </td>
      <td data-dashboard-cost className="align-middle whitespace-nowrap px-4 py-3.5 text-right text-dashboard-action font-bold tabular-nums text-foreground">
        {formatStoredMoney(job.costCents, job.currency)}
      </td>
      {showProgress && (
        <td className="align-middle px-4 py-3.5">
          <ProgressBar value={job.progress} status={job.status} />
        </td>
      )}
    </tr>
  );
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("a, button, input, select, textarea, [role='button']") !== null
  );
}

function MobileJobRow({
  job,
  showProgress,
}: {
  job: DashboardJob;
  showProgress: boolean;
}) {
  return (
    <li>
      <article>
        <ClientPortalLink
          href={`/dashboard/jobs/${job.id}`}
          aria-label={`Open ${job.title}, ${job.reference}`}
          className="group block min-h-11 p-4 transition-colors hover:bg-surface/50 active:bg-ivory focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span data-dashboard-critical-title className="line-clamp-2 break-words text-dashboard-action font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
                {job.title}
              </span>
            </div>
            <StatusBadge status={job.status} compact />
          </div>

          <div data-dashboard-metadata className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 text-dashboard-metadata">
            <JobMetadataItem label="Job reference">
              <span title={job.reference} className="block w-fit max-w-full truncate rounded-md bg-primary/8 px-1.5 py-0.5 font-mono text-dashboard-metadata font-semibold text-primary">
                {job.reference}
              </span>
            </JobMetadataItem>
            <JobMetadataItem label="Job submitted">
              {formatDate(job.submittedDate)}
            </JobMetadataItem>
            <JobMetadataItem label="Job complete">
              {JOB_COMPLETE_VALUE}
            </JobMetadataItem>
            <JobMetadataItem label="Job cost">
              <span data-dashboard-cost className="text-dashboard-action font-bold tabular-nums">
                {formatStoredMoney(job.costCents, job.currency)}
              </span>
            </JobMetadataItem>
            <JobMetadataItem label="Job type" className="col-span-2">
              {job.serviceType}
            </JobMetadataItem>
            {showProgress && (
              <JobMetadataItem label="Progress" className="col-span-2">
                <ProgressBar value={job.progress} status={job.status} />
              </JobMetadataItem>
            )}
          </div>
        </ClientPortalLink>
      </article>
    </li>
  );
}

function JobMetadataItem({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 text-foreground", className)}>
      <span className="block text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-secondary-dark">
        {label}
      </span>
      <div className="mt-0.5 break-words font-medium leading-snug">
        {children}
      </div>
    </div>
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
        <p className="text-dashboard-action font-semibold text-foreground">No jobs found</p>
        <p className="mt-1 text-dashboard-body text-muted">
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
