"use client";

import ClientDashboardTopNav from "./ClientDashboardTopNav";
import ClientDashboardMobileUtilityBar from "./ClientDashboardMobileUtilityBar";
import Footer from "@/components/layout/Footer";
import { cn } from "@/lib/utils";
import {
  CLIENT_PORTAL_WORKSPACE_HORIZONTAL_CLASSNAME,
  CLIENT_PORTAL_WORKSPACE_WIDTH_CLASSNAME,
} from "./client-portal-workspace";

interface ClientDashboardLayoutProps {
  children: React.ReactNode;
  /**
   * Lets self-contained order flows own their vertical and horizontal inset.
   * The wide centered workspace cap remains shared with every portal page.
   */
  flush?: boolean;
}

export default function ClientDashboardLayout({
  children,
  flush = false,
}: ClientDashboardLayoutProps) {
  return (
    // Outer shell is pinned to the dynamic viewport height and never
    // scrolls itself. `min-h-0` lets the inner flex children shrink so the
    // single scroll owner (main, below) can actually overflow instead of
    // pushing the whole shell past the viewport.
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-dashboard-canvas">
      {/* Top nav — fixed within the shell, never scrolls away */}
      <ClientDashboardTopNav />

      {/* `min-h-0` lets the main column remain the single scroll owner. */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* The dashboard's single intended vertical scroll owner. The
            stable data attribute lets the order flow scroll this container
            (not the window) on step transitions. */}
        <main
          data-dashboard-scroll-container
          className="min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
        >
          <div
            className={cn(
              flush
                ? CLIENT_PORTAL_WORKSPACE_WIDTH_CLASSNAME
                : CLIENT_PORTAL_WORKSPACE_HORIZONTAL_CLASSNAME,
              !flush && "py-6 lg:py-8",
            )}
          >
            {children}
          </div>
          <Footer />
          <div
            aria-hidden
            className="h-[calc(2.875rem+env(safe-area-inset-bottom))] bg-primary lg:hidden"
          />
        </main>
      </div>
      <ClientDashboardMobileUtilityBar />
    </div>
  );
}
