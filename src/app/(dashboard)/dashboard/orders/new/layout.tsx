import type { ReactNode } from "react";
import OrderSubmissionRecoveryGate from "@/components/order/OrderSubmissionRecoveryGate";

export default function NewOrderLayout({ children }: { children: ReactNode }) {
  return <OrderSubmissionRecoveryGate>{children}</OrderSubmissionRecoveryGate>;
}
