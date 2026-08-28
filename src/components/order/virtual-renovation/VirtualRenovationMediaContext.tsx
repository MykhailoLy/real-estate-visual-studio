"use client";

import { createContext, useContext } from "react";
import type { ServiceOptionMedia } from "@/lib/site-media";

type VirtualRenovationMediaMap = Record<string, ServiceOptionMedia>;

const VirtualRenovationMediaContext =
  createContext<VirtualRenovationMediaMap>({});

export function VirtualRenovationMediaProvider({
  mediaByKey,
  children,
}: {
  mediaByKey: VirtualRenovationMediaMap;
  children: React.ReactNode;
}) {
  return (
    <VirtualRenovationMediaContext.Provider value={mediaByKey}>
      {children}
    </VirtualRenovationMediaContext.Provider>
  );
}

export function useVirtualRenovationMedia(): VirtualRenovationMediaMap {
  return useContext(VirtualRenovationMediaContext);
}
