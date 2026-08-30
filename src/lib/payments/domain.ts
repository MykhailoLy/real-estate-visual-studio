export const PAYMENT_PROVIDERS = ["stripe"] as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const STRIPE_CHECKOUT_CURRENCY_MAP = {
  USD: "usd",
  EUR: "eur",
  CAD: "cad",
} as const;

export type CheckoutCurrency = keyof typeof STRIPE_CHECKOUT_CURRENCY_MAP;
export type StripeCheckoutCurrency =
  (typeof STRIPE_CHECKOUT_CURRENCY_MAP)[CheckoutCurrency];

export function toStripeCheckoutCurrency(
  value: unknown,
): StripeCheckoutCurrency | null {
  return typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(STRIPE_CHECKOUT_CURRENCY_MAP, value)
    ? STRIPE_CHECKOUT_CURRENCY_MAP[value as CheckoutCurrency]
    : null;
}

export const PAYMENT_STATUSES = [
  "pending",
  "checkout_open",
  "paid",
  "expired",
  "failed",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type CustomerPaymentState =
  | "no_payment_required"
  | "payment_required"
  | "processing"
  | "paid"
  | "partially_refunded"
  | "refunded"
  | "not_available";

export interface AuthoritativePaymentSummary {
  orderId: string;
  orderNumber: string;
  serviceLabel: string;
  itemCount: number;
  finalTotalCents: number | null;
  currency: CheckoutCurrency | null;
  paymentStatus: PaymentStatus | null;
  state: CustomerPaymentState;
}

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
