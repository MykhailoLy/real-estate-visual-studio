"use client";

import { cn } from "@/lib/utils";
import {
  JOB_STATUS_DOT_CLASSES,
  JOB_STATUS_FILTERS,
  type DashboardJobStatusFilter,
} from "./job-status-filters";

interface ClientDashboardMobileStatusFiltersProps {
  activeStatusFilter: DashboardJobStatusFilter;
  onStatusFilter: (status: DashboardJobStatusFilter) => void;
}

export default function ClientDashboardMobileStatusFilters({
  activeStatusFilter,
  onStatusFilter,
}: ClientDashboardMobileStatusFiltersProps) {
  return (
    <div className="border-b border-border bg-white lg:hidden">
      <div
        role="group"
        aria-label="Filter jobs by status"
        className="flex gap-2 overflow-x-auto overscroll-x-contain px-4 py-3 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
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
                "inline-flex min-h-9 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                active
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-border bg-white text-foreground/70 hover:border-primary/40 hover:text-primary"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 flex-shrink-0 rounded-full",
                  active ? "bg-white" : JOB_STATUS_DOT_CLASSES[filter.value]
                )}
                aria-hidden
              />
              {filter.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
