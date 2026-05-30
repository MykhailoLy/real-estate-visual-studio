"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/client-auth-utils";
import { DASHBOARD_NAV_ITEMS } from "./ClientDashboardTopNav";
import type { DashboardJobStatus } from "@/lib/client-dashboard/mock-data";
import { STATUS_LABELS } from "@/lib/client-dashboard/mock-data";
import { useDashboardUser } from "./DashboardUserContext";
import SignOutButton from "./SignOutButton";

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
  all: "bg-muted-light",
  "awaiting-submission": "bg-amber-400",
  "in-progress": "bg-blue-500",
  "revision-requested": "bg-orange-400",
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
  const user = useDashboardUser();

  if (!open) return null;

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const displayName = user?.displayName || "Client";
  const email       = user?.email       || "";
  const initials    = getInitials(user?.profileName || displayName);
  const isLiveUser  = Boolean(user?.email);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard navigation menu"
        className="fixed inset-y-0 left-0 w-[17rem] bg-white z-50 lg:hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 bg-primary flex-shrink-0 border-b border-primary-dark/40">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-[15px] tracking-tight">PicchuSpot</span>
            <span className="inline-flex items-center px-1.5 py-0.5 bg-white/10 border border-white/15 rounded text-secondary text-[9px] font-bold uppercase tracking-[0.18em]">
              Portal
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        {/* Identity strip */}
        <div className="px-4 py-3 bg-surface border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-white">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate leading-tight">{user?.profileName || displayName}</p>
            <p className="text-[11px] text-muted truncate">{email || "Not signed in"}</p>
          </div>
          {isLiveUser ? (
            <span className="ml-auto flex-shrink-0 inline-flex items-center px-1.5 py-0.5 bg-emerald-50 border border-emerald-200/60 rounded text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-700">
              Live
            </span>
          ) : (
            <span className="ml-auto flex-shrink-0 inline-flex items-center px-1.5 py-0.5 bg-amber-50 border border-amber-200/60 rounded text-[9px] font-bold uppercase tracking-[0.12em] text-amber-600">
              Demo
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Nav links */}
          <nav aria-label="Dashboard pages" className="px-2 py-3 space-y-0.5">
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-light select-none">Menu</p>
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
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150",
                    isNewOrder
                      ? "bg-secondary/10 text-secondary-dark hover:bg-secondary/18 border border-secondary/25 mt-1"
                      : active
                      ? "bg-primary text-white shadow-sm"
                      : "text-foreground/65 hover:text-foreground hover:bg-surface"
                  )}
                >
                  <item.icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isNewOrder ? "text-secondary-dark" : active ? "text-white" : "text-muted-light"
                    )}
                    aria-hidden
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Status filters */}
          {onStatusFilter && (
            <>
              <div className="mx-4 border-t border-border" />
              <div className="px-2 py-3">
                <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-light select-none">Filter jobs</p>
                <div className="space-y-0.5">
                  {STATUS_FILTERS.map((f) => {
                    const active = activeStatusFilter === f.value;
                    return (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => { onStatusFilter(f.value); onClose(); }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 text-left",
                          active
                            ? "bg-primary/8 text-primary font-semibold"
                            : "text-foreground/60 hover:text-foreground hover:bg-surface font-medium"
                        )}
                      >
                        <span
                          className={cn("w-2 h-2 rounded-full flex-shrink-0", active ? statusDotColor[f.value] : "bg-border")}
                          aria-hidden
                        />
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-2 py-2 space-y-0.5">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-muted hover:text-primary hover:bg-surface transition-colors"
          >
            <ArrowUpRight className="w-4 h-4 flex-shrink-0" aria-hidden />
            Back to website
          </Link>
          <SignOutButton
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-muted hover:text-foreground hover:bg-surface transition-colors disabled:opacity-60"
          />
        </div>
      </div>
    </>
  );
}
