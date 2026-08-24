import {
  getPersistedOrderPaymentState,
  type PaymentStateOrder,
  type PersistedOrderPayment,
  type PersistedOrderPaymentState,
} from "./payment-state.ts";

export const PRODUCTION_ADVANCING_ORDER_STATUSES = [
  "confirmed",
  "in-progress",
  "delivered",
] as const;

export type ProductionAdvancingOrderStatus =
  (typeof PRODUCTION_ADVANCING_ORDER_STATUSES)[number];

export class AdminPaymentGateError extends Error {
  readonly paymentState: PersistedOrderPaymentState;

  constructor(paymentState: PersistedOrderPaymentState) {
    super(
      paymentState === "processing"
        ? "Payment verification is still processing. Wait for Paid before advancing this order."
        : "A matching Paid payment is required before this fixed-price order can enter production.",
    );
    this.name = "AdminPaymentGateError";
    this.paymentState = paymentState;
  }
}

/**
 * Server-side fulfillment gate. Only fixed-price Checkout orders are gated;
 * custom-quote and otherwise ineligible orders retain the manual workflow.
 */
export function assertAdminOrderStatusTransitionAllowed(
  order: PaymentStateOrder,
  payment: PersistedOrderPayment | null,
  newStatus: string,
): PersistedOrderPaymentState {
  const paymentState = getPersistedOrderPaymentState(order, payment);
  const advancesProduction = PRODUCTION_ADVANCING_ORDER_STATUSES.some(
    (status) => status === newStatus,
  );

  if (
    advancesProduction &&
    paymentState !== "paid" &&
    paymentState !== "manual_review"
  ) {
    throw new AdminPaymentGateError(paymentState);
  }

  return paymentState;
}
