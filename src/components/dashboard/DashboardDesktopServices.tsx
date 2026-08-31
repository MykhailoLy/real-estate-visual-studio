"use client";

import { useMemo } from "react";
import DashboardQuickStart from "./DashboardQuickStart";
import type { OrderCardImage } from "@/lib/order-card-media";
import type { OrderExamplePair } from "@/lib/order-card-examples";
import { getOrderServiceCards } from "@/lib/order-services";
import type { PortfolioServiceSlug } from "@/lib/portfolio";

export interface DashboardDesktopServicesProps {
  images?: ReadonlyArray<readonly [string, OrderCardImage]>;
  examples?: ReadonlyArray<
    readonly [PortfolioServiceSlug, OrderExamplePair[]]
  >;
}

/**
 * Desktop-only catalog body. The responsive parent imports this module only
 * after the viewport reaches the dashboard's lg breakpoint, so service-card
 * images are never mounted by the compact dashboard experience.
 */
export default function DashboardDesktopServices({
  images,
  examples,
}: DashboardDesktopServicesProps) {
  const imageMap = useMemo(() => new Map(images ?? []), [images]);
  const exampleMap = useMemo(() => new Map(examples ?? []), [examples]);

  return (
    <DashboardQuickStart
      services={getOrderServiceCards()}
      images={imageMap}
      examples={exampleMap}
    />
  );
}
