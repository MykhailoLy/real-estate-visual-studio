"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DASHBOARD_NAV_ITEMS } from "./ClientDashboardTopNav";
import type { DashboardJobStatus } from "@/lib/client-dashboard/mock-data";
import { STATUS_LABELS } from "@/lib/client-dashboard/mock-data";

interface ClientDashboardMobileNavProps {
  open: boolean;
  onClose: () => void;
  activeStatusFilter?: DashboardJobStatus | "all";
  onStatusFilter?: (status: DashboardJobStatus | "all") => void;
}

const STATUS_FILTERS: Array<{ value: DashboardJobStatus | "all"; label: string }> = [
  { value: "all", label: "All Jobs" },
  { value: "awaiting-submission", label: STATUS_LABELS["awaiting-submission"] },
  { value: "in-progress", label: STATUS_LABELS["in-progress"] },
  { value: "revision-requested", label: STATUS_LABELS["revision-requested"] },
  { value: "completed", label: STATUS_LABELS["completed"] },
];

const statusDotColor: Record<DashboardJobStatus | "all", string> = {
  all: "bg-foreground/30",
  "awaiting-submission": "bg-amber-500",
  "in-progress": "bg-blue-500",
  "revision-requested": "bg-orange-500",
  completed: "bg-emerald-500",
  cancelled: "bg-slate-400",
};

export default function ClientDashboardMobileNav({
  open,
  onClose,
  activeStatusFilter = "all",
  onStatusFilter,
}: ClientDashboardMobileNavProps) {
  const pathname = usePathname() ?? "/dashboard";

  if (!open) return null;

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-label="Dashboard navigation menu"
        className="fixed inset-y-0 left-0 w-72 bg-white z-50 lg:hidden flex flex-col shadow-2xl"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 h-14 bg-primary flex-shrink-0">
          <span className="text-white font-bold text-base tracking-tight">
            PicchuSpot
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Main nav links */}
          <nav aria-label="Dashboard pages" className="px-3 py-4 space-y-1">
            {DASHBOARD_NAV_ITEMS.map((item) => {
              const active = isActive(item.href, item.exact);
              const isNewOrder = item.href === "/order";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={active && !isNewOrder ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors",
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

          {/* Status quick filters */}
          {onStatusFilter && (
            <div className="px-3 pb-4">
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
                Filter by status
              </p>
              <div className="space-y-0.5">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => {
                      onStatusFilter(f.value);
                      onClose();
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left",
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
            </div>
          )}
        </div>
      </div>
    </>
  );
}
