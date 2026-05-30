"use client";

import { useState } from "react";
import ClientDashboardTopNav from "./ClientDashboardTopNav";
import ClientDashboardSidebar from "./ClientDashboardSidebar";
import ClientDashboardMobileNav from "./ClientDashboardMobileNav";
import type { DashboardJobStatus } from "@/lib/client-dashboard/mock-data";

interface ClientDashboardLayoutProps {
  children: React.ReactNode;
  /** Pass true on pages that show the status filter sidebar widget */
  showStatusFilter?: boolean;
}

export default function ClientDashboardLayout({
  children,
  showStatusFilter = false,
}: ClientDashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState<
    DashboardJobStatus | "all"
  >("all");

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
        activeStatusFilter={showStatusFilter ? activeStatusFilter : undefined}
        onStatusFilter={showStatusFilter ? setActiveStatusFilter : undefined}
      />

      {/* Body: sidebar + main content */}
      <div className="flex flex-1 overflow-hidden">
        <ClientDashboardSidebar
          activeStatusFilter={showStatusFilter ? activeStatusFilter : undefined}
          onStatusFilter={showStatusFilter ? setActiveStatusFilter : undefined}
        />

        {/* Scrollable main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            {/* Pass filter state to children via a context-less prop drilling alternative.
                Pages that need the filter read it themselves from a shared store.
                For Phase 1 this is fine — wire up context/zustand later. */}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
