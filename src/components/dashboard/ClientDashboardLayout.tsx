"use client";

import ClientDashboardTopNav from "./ClientDashboardTopNav";

interface ClientDashboardLayoutProps {
  children: React.ReactNode;
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
  contentClassName,
}: ClientDashboardLayoutProps) {
  return (
    // Outer shell is pinned to the dynamic viewport height and never
    // scrolls itself. `min-h-0` lets the inner flex children shrink so the
    // single scroll owner (main, below) can actually overflow instead of
    // pushing the whole shell past the viewport.
    <div className="flex flex-col h-[100dvh] min-h-0 bg-surface overflow-hidden">
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
          <div className={contentClassName ?? DEFAULT_CONTENT_CLASSNAME}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
