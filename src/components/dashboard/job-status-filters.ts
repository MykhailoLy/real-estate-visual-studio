import type { DashboardJobStatus } from "@/lib/client-dashboard/mock-data";
import { STATUS_LABELS } from "@/lib/client-dashboard/mock-data";

export type DashboardJobStatusFilter = DashboardJobStatus | "all";

export const JOB_STATUS_FILTERS: ReadonlyArray<{
  value: DashboardJobStatusFilter;
  label: string;
}> = [
  { value: "all", label: "All Jobs" },
  { value: "awaiting-submission", label: STATUS_LABELS["awaiting-submission"] },
  { value: "in-progress", label: STATUS_LABELS["in-progress"] },
  { value: "pending-rework", label: STATUS_LABELS["pending-rework"] },
  { value: "rework-in-progress", label: STATUS_LABELS["rework-in-progress"] },
  { value: "new-version-ready", label: STATUS_LABELS["new-version-ready"] },
  { value: "completed", label: STATUS_LABELS.completed },
];

export const JOB_STATUS_DOT_CLASSES: Record<
  DashboardJobStatusFilter,
  string
> = {
  all: "bg-muted-light",
  "awaiting-submission": "bg-amber-400",
  "in-progress": "bg-blue-500",
  "revision-requested": "bg-orange-400",
  "pending-rework": "bg-orange-400",
  "rework-in-progress": "bg-sky-500",
  "new-version-ready": "bg-violet-500",
  completed: "bg-emerald-500",
  cancelled: "bg-slate-400",
};
