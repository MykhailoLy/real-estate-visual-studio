"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DASHBOARD_NAV_ITEMS } from "./ClientDashboardTopNav";
import type { DashboardJobStatus } from "@/lib/client-dashboard/mock-data";
import {
  JOB_STATUS_DOT_CLASSES,
  JOB_STATUS_FILTERS,
} from "./job-status-filters";

interface ClientDashboardSidebarProps {
  activeStatusFilter?: DashboardJobStatus | "all";
  onStatusFilter?: (status: DashboardJobStatus | "all") => void;
}

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
            const isNewOrder = item.href === "/dashboard/orders/new";
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
              {JOB_STATUS_FILTERS.map((f) => {
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
                        active ? JOB_STATUS_DOT_CLASSES[f.value] : "bg-border"
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
      <div className="mt-auto px-2 pb-4 pt-2">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" aria-hidden />
          <span className="text-[10px] text-muted-light font-medium select-none">Client Portal</span>
        </div>
      </div>
    </aside>
  );
}
