"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DASHBOARD_NAV_ITEMS } from "./ClientDashboardTopNav";
import type { DashboardJobStatus } from "@/lib/client-dashboard/mock-data";
import { STATUS_LABELS } from "@/lib/client-dashboard/mock-data";

interface ClientDashboardSidebarProps {
  activeStatusFilter?: DashboardJobStatus | "all";
  onStatusFilter?: (status: DashboardJobStatus | "all") => void;
}

const STATUS_FILTERS: Array<{
  value: DashboardJobStatus | "all";
  label: string;
}> = [
  { value: "all", label: "All Jobs" },
  { value: "awaiting-submission", label: STATUS_LABELS["awaiting-submission"] },
  { value: "in-progress", label: STATUS_LABELS["in-progress"] },
  { value: "revision-requested", label: STATUS_LABELS["revision-requested"] },
  { value: "completed", label: STATUS_LABELS["completed"] },
];

const statusDotColor: Record<DashboardJobStatus | "all", string> = {
  all: "bg-foreground/25",
  "awaiting-submission": "bg-amber-500",
  "in-progress": "bg-blue-500",
  "revision-requested": "bg-orange-500",
  completed: "bg-emerald-500",
  cancelled: "bg-slate-400",
};

export default function ClientDashboardSidebar({
  activeStatusFilter = "all",
  onStatusFilter,
}: ClientDashboardSidebarProps) {
  const pathname = usePathname() ?? "/dashboard";

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <aside className="hidden lg:flex flex-col w-56 xl:w-60 flex-shrink-0 bg-white border-r border-border">
      {/* Main nav */}
      <nav
        aria-label="Dashboard pages"
        className="px-3 pt-5 pb-3 space-y-0.5"
      >
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
          Navigation
        </p>
        {DASHBOARD_NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          const isNewOrder = item.href === "/order";
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active && !isNewOrder ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors",
                isNewOrder
                  ? "bg-secondary/10 text-secondary-dark hover:bg-secondary/20 border border-secondary/30 mt-2"
                  : active
                  ? "bg-primary/8 text-primary"
                  : "text-foreground/70 hover:text-primary hover:bg-surface"
              )}
            >
              <item.icon
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  isNewOrder
                    ? "text-secondary-dark"
                    : active
                    ? "text-primary"
                    : "text-muted"
                )}
                aria-hidden
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-border" />

      {/* Status quick filters */}
      {onStatusFilter && (
        <div className="px-3 pt-4 pb-3 space-y-0.5">
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
            Filter by status
          </p>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => onStatusFilter(f.value)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors text-left",
                activeStatusFilter === f.value
                  ? "bg-primary/8 text-primary font-semibold"
                  : "text-foreground/65 hover:text-primary hover:bg-surface"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  statusDotColor[f.value]
                )}
                aria-hidden
              />
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto px-3 pb-5 pt-3 border-t border-border">
        <p className="px-3 text-[10px] text-muted">
          Phase 1 Shell · Demo Mode
        </p>
      </div>
    </aside>
  );
}
