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
  className,
}: DashboardStatCardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-border rounded-xl p-5 flex items-start gap-4",
        "shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-px",
        accentBorder && `border-l-2 ${accentBorder}`,
        className
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
          iconBg
        )}
      >
        <Icon className={cn("w-5 h-5", iconColor)} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light mb-1 leading-none">
          {label}
        </p>
        <p className="text-[26px] font-bold text-foreground tabular-nums leading-none">
          {value}
        </p>
        {note && (
          <p className="text-[11px] text-muted mt-1.5 leading-snug">{note}</p>
        )}
      </div>
    </div>
  );
}
