import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface DashboardStatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: string;
  className?: string;
}

export default function DashboardStatCard({
  label,
  value,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  trend,
  className,
}: DashboardStatCardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-border rounded-xl p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow",
        className
      )}
    >
      <div
        className={cn(
          "w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0",
          iconBg
        )}
      >
        <Icon className={cn("w-5 h-5", iconColor)} aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted mb-1">
          {label}
        </p>
        <p className="text-2xl font-bold text-foreground tabular-nums">
          {value}
        </p>
        {trend && (
          <p className="text-[11px] text-muted mt-0.5">{trend}</p>
        )}
      </div>
    </div>
  );
}
