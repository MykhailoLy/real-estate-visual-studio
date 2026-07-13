export const PAYMENT_PROVIDERS = ["stripe"] as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const STRIPE_LAUNCH_CURRENCY = "usd" as const;

export const PAYMENT_STATUSES = [
  "pending",
  "checkout_open",
  "paid",
  "expired",
  "failed",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const REFUND_STATUSES = ["none", "partial", "full"] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

const PAYMENT_STATUS_TRANSITIONS: Record<
  PaymentStatus,
  readonly PaymentStatus[]
> = {
  pending: ["checkout_open", "failed"],
  checkout_open: ["paid", "expired", "failed"],
  paid: [],
  expired: ["checkout_open"],
  failed: ["checkout_open"],
};

const REFUND_STATUS_TRANSITIONS: Record<
  RefundStatus,
  readonly RefundStatus[]
> = {
  none: ["partial", "full"],
  partial: ["full"],
  full: [],
};

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.some((candidate) => candidate === value);
}

export function isPaymentProvider(value: unknown): value is PaymentProvider {
  return isOneOf(PAYMENT_PROVIDERS, value);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return isOneOf(PAYMENT_STATUSES, value);
}

export function isRefundStatus(value: unknown): value is RefundStatus {
  return isOneOf(REFUND_STATUSES, value);
}

export function transitionPaymentStatus(
  current: PaymentStatus,
  next: PaymentStatus,
): PaymentStatus | null {
  return PAYMENT_STATUS_TRANSITIONS[current].includes(next) ? next : null;
}

export function transitionRefundStatus(
  current: RefundStatus,
  next: RefundStatus,
): RefundStatus | null {
  return REFUND_STATUS_TRANSITIONS[current].includes(next) ? next : null;
}
