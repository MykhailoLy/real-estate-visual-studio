import { cn } from "@/lib/utils";
import type { DashboardJobStatus } from "@/lib/client-dashboard/mock-data";
import { STATUS_LABELS } from "@/lib/client-dashboard/mock-data";

interface StatusBadgeProps {
  status: DashboardJobStatus;
  /** compact = smaller padding, used in tight table cells */
  compact?: boolean;
  className?: string;
}

const statusConfig: Record<
  DashboardJobStatus,
  { bg: string; text: string; border: string; dot: string }
> = {
  "awaiting-submission": {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-400",
  },
  "in-progress": {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  "revision-requested": {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    dot: "bg-orange-400",
  },
  completed: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  cancelled: {
    bg: "bg-slate-100",
    text: "text-slate-500",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
};

export default function StatusBadge({ status, compact = false, className }: StatusBadgeProps) {
  const c = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold border whitespace-nowrap",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        c.bg,
        c.text,
        c.border,
        className
      )}
    >
      <span
        className={cn("rounded-full flex-shrink-0", compact ? "w-1.5 h-1.5" : "w-1.5 h-1.5", c.dot)}
        aria-hidden
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
