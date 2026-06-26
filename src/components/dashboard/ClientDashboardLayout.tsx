"use client";

import ClientDashboardTopNav from "./ClientDashboardTopNav";
import ClientDashboardSidebar from "./ClientDashboardSidebar";
import ClientDashboardMobileStatusFilters from "./ClientDashboardMobileStatusFilters";
import type { DashboardJobStatus } from "@/lib/client-dashboard/mock-data";

interface ClientDashboardLayoutProps {
  children: React.ReactNode;
  /**
   * When both are provided, the layout renders controlled status filters in
   * the desktop sidebar and in a compact row above the content below `lg`.
   * The page owns the state so every filter surface drives the same jobs table.
   */
  statusFilter?: DashboardJobStatus | "all";
  onStatusFilterChange?: (status: DashboardJobStatus | "all") => void;
  /**
   * Opt-in override for the main content wrapper classes. Defaults to the
   * centered max-w-6xl container every dashboard page uses. The New Order
   * hub passes a full-width variant so its card grid fills the main area on
   * large screens. Existing pages are unaffected.
   */
  contentClassName?: string;
}

/** Default centered container — unchanged behaviour for every other page. */
const DEFAULT_CONTENT_CLASSNAME =
  "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8";

export default function ClientDashboardLayout({
  children,
  statusFilter,
  onStatusFilterChange,
  contentClassName,
}: ClientDashboardLayoutProps) {
  const showStatusFilter =
    statusFilter !== undefined && onStatusFilterChange !== undefined;

  return (
    // Outer shell is pinned to the dynamic viewport height and never
    // scrolls itself. `min-h-0` lets the inner flex children shrink so the
    // single scroll owner (main, below) can actually overflow instead of
    // pushing the whole shell past the viewport.
    <div className="flex flex-col h-[100dvh] min-h-0 bg-surface overflow-hidden">
      {/* Top nav — fixed within the shell, never scrolls away */}
      <ClientDashboardTopNav />

      {/* Body: sidebar + main content. `min-h-0` is required so the row can
          shrink and the main column becomes the scroll container. */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <ClientDashboardSidebar
          activeStatusFilter={showStatusFilter ? statusFilter : undefined}
          onStatusFilter={showStatusFilter ? onStatusFilterChange : undefined}
        />

        {/* The dashboard's single intended vertical scroll owner. The
            stable data attribute lets the order flow scroll this container
            (not the window) on step transitions. */}
        <main
          data-dashboard-scroll-container
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        >
          {showStatusFilter && (
            <ClientDashboardMobileStatusFilters
              activeStatusFilter={statusFilter}
              onStatusFilter={onStatusFilterChange}
            />
          )}
          <div className={contentClassName ?? DEFAULT_CONTENT_CLASSNAME}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
