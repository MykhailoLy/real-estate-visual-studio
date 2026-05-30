"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
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
  all: "bg-muted-light",
  "awaiting-submission": "bg-amber-400",
  "in-progress": "bg-blue-500",
  "revision-requested": "bg-orange-400",
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
    <aside className="hidden lg:flex flex-col w-56 xl:w-60 flex-shrink-0 bg-white border-r border-border overflow-y-auto">

      {/* ── Main navigation ── */}
      <nav aria-label="Dashboard pages" className="px-2 pt-4 pb-2">
        <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-light select-none">
          Menu
        </p>
        <div className="space-y-0.5">
          {DASHBOARD_NAV_ITEMS.map((item) => {
            const active = isActive(item.href, item.exact);
            const isNewOrder = item.href === "/order";
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active && !isNewOrder ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150",
                  isNewOrder
                    ? "bg-secondary/10 text-secondary-dark hover:bg-secondary/18 border border-secondary/25 mt-1"
                    : active
                    ? "bg-primary text-white shadow-sm"
                    : "text-foreground/65 hover:text-foreground hover:bg-surface"
                )}
              >
                <item.icon
                  className={cn(
                    "w-4 h-4 flex-shrink-0 transition-colors",
                    isNewOrder
                      ? "text-secondary-dark"
                      : active
                      ? "text-white"
                      : "text-muted-light"
                  )}
                  aria-hidden
                />
                <span className="truncate">{item.label}</span>
                {/* Active indicator bar on left edge */}
                {active && !isNewOrder && (
                  <span className="sr-only">(current page)</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Divider ── */}
      <div className="mx-4 my-2 border-t border-border" />

      {/* ── Status quick filters (only on /dashboard/jobs) ── */}
      {onStatusFilter && (
        <>
          <div className="px-2 pb-2">
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-light select-none">
              Filter jobs
            </p>
            <div className="space-y-0.5">
              {STATUS_FILTERS.map((f) => {
                const active = activeStatusFilter === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => onStatusFilter(f.value)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 text-left",
                      active
                        ? "bg-primary/8 text-primary font-semibold"
                        : "text-foreground/60 hover:text-foreground hover:bg-surface font-medium"
                    )}
                  >
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0 transition-colors",
                        active ? statusDotColor[f.value] : "bg-border"
                      )}
                      aria-hidden
                    />
                    <span className="truncate">{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mx-4 my-2 border-t border-border" />
        </>
      )}

      {/* ── Footer ── */}
      <div className="mt-auto px-2 pb-4 pt-2 space-y-0.5">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-muted hover:text-primary hover:bg-surface transition-colors"
        >
          <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
          Back to website
        </Link>
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" aria-hidden />
          <span className="text-[10px] text-muted-light font-medium select-none">Files: demo data</span>
        </div>
      </div>
    </aside>
  );
}
