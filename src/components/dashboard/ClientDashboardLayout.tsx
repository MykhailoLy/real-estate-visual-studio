"use client";

import { useState } from "react";
import ClientDashboardTopNav from "./ClientDashboardTopNav";
import ClientDashboardSidebar from "./ClientDashboardSidebar";
import ClientDashboardMobileNav from "./ClientDashboardMobileNav";
import type { DashboardJobStatus } from "@/lib/client-dashboard/mock-data";

interface ClientDashboardLayoutProps {
  children: React.ReactNode;
  /**
   * When provided, the layout renders sidebar/mobile status filter controls
   * and keeps them in sync with the external controlled state.
   * The page owns the state and passes it in — this lets the sidebar filters
   * actually drive the jobs table on the same page.
   */
  statusFilter?: DashboardJobStatus | "all";
  onStatusFilterChange?: (status: DashboardJobStatus | "all") => void;
}

export default function ClientDashboardLayout({
  children,
  statusFilter,
  onStatusFilterChange,
}: ClientDashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const showStatusFilter =
    statusFilter !== undefined && onStatusFilterChange !== undefined;

  return (
    <div className="flex flex-col h-screen bg-surface overflow-hidden">
      {/* Top nav — sticky at top */}
      <ClientDashboardTopNav
        onMobileMenuToggle={() => setMobileMenuOpen((v) => !v)}
        mobileMenuOpen={mobileMenuOpen}
      />

      {/* Mobile drawer */}
      <ClientDashboardMobileNav
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        activeStatusFilter={showStatusFilter ? statusFilter : undefined}
        onStatusFilter={showStatusFilter ? onStatusFilterChange : undefined}
      />

      {/* Body: sidebar + main content */}
      <div className="flex flex-1 overflow-hidden">
        <ClientDashboardSidebar
          activeStatusFilter={showStatusFilter ? statusFilter : undefined}
          onStatusFilter={showStatusFilter ? onStatusFilterChange : undefined}
        />

        {/* Scrollable main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
