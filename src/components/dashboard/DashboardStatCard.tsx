import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface DashboardStatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  /** Optional small secondary note under the value */
  note?: string;
  /** Optional coloured left-border accent class e.g. "border-l-blue-500" */
  accentBorder?: string;
  compact?: boolean;
  className?: string;
}

export default function DashboardStatCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/8",
  note,
  accentBorder,
  compact = false,
  className,
}: DashboardStatCardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-border rounded-xl flex items-start",
        compact ? "gap-3 p-3 sm:p-4" : "gap-4 p-5",
        "shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-px",
        accentBorder && `border-l-2 ${accentBorder}`,
        className
      )}
    >
      <div
        className={cn(
          "rounded-lg flex items-center justify-center flex-shrink-0",
          compact ? "h-8 w-8 sm:h-9 sm:w-9" : "h-10 w-10",
          iconBg
        )}
      >
        <Icon
          className={cn(compact ? "h-4 w-4" : "h-5 w-5", iconColor)}
          aria-hidden
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-dashboard-kicker font-bold uppercase text-muted-light">
          {label}
        </p>
        <p
          className={cn(
            "font-bold text-foreground tabular-nums leading-none",
            compact ? "text-xl sm:text-2xl" : "text-[26px]",
          )}
        >
          {value}
        </p>
        {note && (
          <p
            className={cn(
              "mt-1.5 text-dashboard-metadata text-muted",
              compact && "hidden sm:block",
            )}
          >
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
