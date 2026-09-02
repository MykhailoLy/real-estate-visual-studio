"use client";

import { cn } from "@/lib/utils";
import {
  JOB_STATUS_DOT_CLASSES,
  JOB_STATUS_FILTERS,
  type DashboardJobStatusFilter,
} from "./job-status-filters";

interface ClientJobsStatusFiltersProps {
  activeStatusFilter: DashboardJobStatusFilter;
  onStatusFilter: (status: DashboardJobStatusFilter) => void;
}

export default function ClientJobsStatusFilters({
  activeStatusFilter,
  onStatusFilter,
}: ClientJobsStatusFiltersProps) {
  return (
    <section
      aria-labelledby="jobs-status-filters-title"
      className="mb-4 border-b border-border pb-4"
    >
      <h3
        id="jobs-status-filters-title"
        className="mb-2 text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-secondary-dark"
      >
        Filter jobs by status
      </h3>
      <div
        role="group"
        aria-label="Filter jobs by status"
        className="flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible [&::-webkit-scrollbar]:hidden"
      >
        {JOB_STATUS_FILTERS.map((filter) => {
          const active = activeStatusFilter === filter.value;

          return (
            <button
              key={filter.value}
              type="button"
              data-job-status-filter={filter.value}
              aria-pressed={active}
              onClick={() => onStatusFilter(filter.value)}
              className={cn(
                "inline-flex min-h-11 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-dashboard-action font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                active
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-border bg-white text-foreground/70 hover:border-primary/40 hover:text-primary",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 flex-shrink-0 rounded-full",
                  active ? "bg-white" : JOB_STATUS_DOT_CLASSES[filter.value],
                )}
                aria-hidden
              />
              {filter.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
