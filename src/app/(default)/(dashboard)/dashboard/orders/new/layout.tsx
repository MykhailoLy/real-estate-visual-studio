import type { ReactNode } from "react";
import OrderSubmissionRecoveryGate from "@/components/order/OrderSubmissionRecoveryGate";
import { PartnerPricingProvider } from "@/components/order/PartnerPricingContext";
import { getDashboardRequestUser } from "@/lib/dashboard-request-context";
import { getPartnerClient } from "@/lib/account-pricing-server";

export default async function NewOrderLayout({ children }: { children: ReactNode }) {
  const user = await getDashboardRequestUser();
  // QA has no real account. A trusted lookup failure must not become ordinary pricing.
  const partnerClient = user && !user.isQaPreview ? await getPartnerClient(user.id) : false;
  return (
    <PartnerPricingProvider partnerClient={partnerClient}>
      <OrderSubmissionRecoveryGate>{children}</OrderSubmissionRecoveryGate>
    </PartnerPricingProvider>
  );
}
