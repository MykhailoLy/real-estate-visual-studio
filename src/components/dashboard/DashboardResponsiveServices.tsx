"use client";

import dynamic from "next/dynamic";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import ClientPortalLink from "./ClientPortalLink";
import type { DashboardDesktopServicesProps } from "./DashboardDesktopServices";

const DASHBOARD_DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

const DesktopDashboardServices = dynamic(
  () => import("./DashboardDesktopServices"),
  { ssr: false },
);

/**
 * Keeps the six-card service catalog out of the below-lg dashboard DOM.
 * Mobile and tablet get one lightweight route into the unchanged full catalog.
 */
export default function DashboardResponsiveServices(
  props: DashboardDesktopServicesProps,
) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DASHBOARD_DESKTOP_MEDIA_QUERY);
    const update = () => setIsDesktop(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return (
    <>
      <section
        aria-labelledby="browse-dashboard-services-heading"
        className="rounded-xl border border-border bg-white p-4 shadow-sm lg:hidden"
      >
        <h2
          id="browse-dashboard-services-heading"
          className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary"
        >
          Browse services
        </h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm leading-relaxed text-muted">
            Choose a service and start a new order.
          </p>
          <ClientPortalLink
            href="/dashboard/orders/new"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Browse services
            <ArrowRight className="h-4 w-4" aria-hidden />
          </ClientPortalLink>
        </div>
      </section>

      {isDesktop && (
        <div className="hidden min-w-0 lg:block">
          <DesktopDashboardServices {...props} />
        </div>
      )}
    </>
  );
}
