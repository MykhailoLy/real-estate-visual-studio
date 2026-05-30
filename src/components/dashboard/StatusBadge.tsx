import { cn } from "@/lib/utils";
import type { DashboardJobStatus } from "@/lib/client-dashboard/mock-data";
import { STATUS_LABELS } from "@/lib/client-dashboard/mock-data";

interface StatusBadgeProps {
  status: DashboardJobStatus;
  className?: string;
}

const statusStyles: Record<DashboardJobStatus, string> = {
  "awaiting-submission":
    "bg-amber-50 text-amber-700 border border-amber-200",
  "in-progress":
    "bg-blue-50 text-blue-700 border border-blue-200",
  "revision-requested":
    "bg-orange-50 text-orange-700 border border-orange-200",
  completed:
    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  cancelled:
    "bg-slate-100 text-slate-500 border border-slate-200",
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap",
        statusStyles[status],
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          status === "awaiting-submission" && "bg-amber-500",
          status === "in-progress" && "bg-blue-500",
          status === "revision-requested" && "bg-orange-500",
          status === "completed" && "bg-emerald-500",
          status === "cancelled" && "bg-slate-400"
        )}
        aria-hidden
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
