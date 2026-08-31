"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import MobileDashboardServiceSelector from "./MobileDashboardServiceSelector";
import type { DashboardDesktopServicesProps } from "./DashboardDesktopServices";

const DASHBOARD_DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

const DesktopDashboardServices = dynamic(
  () => import("./DashboardDesktopServices"),
  { ssr: false },
);

/**
 * Keeps the media-heavy desktop cards out of the below-lg dashboard DOM.
 * Mobile and tablet render a registry-driven text selector with no imagery.
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
      <MobileDashboardServiceSelector />

      {isDesktop && (
        <div className="hidden min-w-0 lg:block">
          <DesktopDashboardServices {...props} />
        </div>
      )}
    </>
  );
}
