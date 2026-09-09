"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { PricingSnapshot } from "@/lib/pricing/types";

interface PartnerPricingPreview {
  partnerClient: boolean;
  applyPartnerSnapshot: (snapshot: PricingSnapshot | undefined) => void;
}

const PartnerPricingContext = createContext<PartnerPricingPreview>({
  partnerClient: false,
  applyPartnerSnapshot: () => {},
});

/** Shared display state for the order forms, reviews and summary. Never authority. */
export function PartnerPricingProvider({
  partnerClient: initialPartnerClient,
  children,
}: { partnerClient: boolean; children: ReactNode }) {
  const [partnerClient, setPartnerClient] = useState(initialPartnerClient);
  const applyPartnerSnapshot = useCallback((snapshot: PricingSnapshot | undefined) => {
    if (typeof snapshot?.partnerClient === "boolean") setPartnerClient(snapshot.partnerClient);
  }, []);
  const value = useMemo(() => ({ partnerClient, applyPartnerSnapshot }), [partnerClient, applyPartnerSnapshot]);
  return <PartnerPricingContext.Provider value={value}>{children}</PartnerPricingContext.Provider>;
}

export function usePartnerPricing(): PartnerPricingPreview {
  return useContext(PartnerPricingContext);
}
