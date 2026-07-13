import "server-only";

import { absoluteUrl } from "@/lib/seo";
import { getStripeApiConfig, getStripeServerClient } from "./stripe-server.ts";
import {
  CheckoutEligibilityError,
  getCheckoutPrice,
  type CheckoutEligibleOrder,
} from "./checkout-eligibility.ts";
import {
  CheckoutRepositoryError,
  type CheckoutRepository,
  type OrderPaymentRecord,
} from "./checkout-repository.ts";

const ATTEMPT_LEASE_MS = 5 * 60 * 1000;

export interface CheckoutStripeClient {
  checkout: {
    sessions: {
      create(
        params: CheckoutSessionCreateParams,
        options: { idempotencyKey: string },
      ): Promise<CheckoutSession>;
      retrieve(
        sessionId: string,
      ): Promise<CheckoutSession>;
    };
  };
}

interface CheckoutSession {
  id?: string;
  url: string | null;
  status?: "open" | "complete" | "expired";
  expires_at: number | null;
  livemode: boolean;
}

interface CheckoutSessionCreateParams {
  mode: "payment";
  payment_method_types: ["card"];
  automatic_tax: { enabled: true };
  allow_promotion_codes: false;
  client_reference_id: string;
  customer_email?: string;
  success_url: string;
  cancel_url: string;
  metadata: Record<string, string>;
  payment_intent_data: { metadata: Record<string, string> };
  line_items: Array<{
    quantity: 1;
    price_data: {
      currency: "usd";
      unit_amount: number;
      product_data: { name: string };
    };
  }>;
}

export class CheckoutServiceError extends Error {
  readonly status: 404 | 409 | 422 | 502 | 503;
  readonly code: string;

  constructor(
    status: 404 | 409 | 422 | 502 | 503,
    code: string,
    message: string,
  ) {
    super(message);
    this.name = "CheckoutServiceError";
    this.status = status;
    this.code = code;
  }
}

export interface CheckoutServiceDependencies {
  repository: CheckoutRepository;
  getStripeClient?: () => CheckoutStripeClient;
  getStripeMode?: () => "test" | "live";
  now?: () => Date;
}

export interface CreateCheckoutSessionInput {
  orderId: string;
  authenticatedUserId: string;
}

export interface CreateCheckoutSessionResult {
  url: string;
}

/**
 * Server-side Checkout workflow. The route supplies the authenticated user ID;
 * all amount, ownership, eligibility, and redirect details are loaded here.
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
  dependencies: CheckoutServiceDependencies,
): Promise<CreateCheckoutSessionResult> {
  const now = dependencies.now ?? (() => new Date());
  const order = await dependencies.repository.getOrder(input.orderId);
  if (!order || order.user_id !== input.authenticatedUserId) {
    throw new CheckoutServiceError(404, "order-not-found", "Order not found.");
  }

  const price = toServiceError(() => getCheckoutPrice(order));
  const stripeMode = getStripeMode(dependencies);
  const stripeLivemode = stripeMode === "live";

  let payment = await dependencies.repository.getPayment(order.id);
  if (!payment) {
    payment = await dependencies.repository.createPayment({
      orderId: order.id,
      subtotalCents: price.subtotalCents,
      currency: price.currency,
      stripeLivemode,
    });
    if (!payment) {
      payment = await dependencies.repository.getPayment(order.id);
      if (!payment) {
        throw new CheckoutServiceError(502, "payment-storage", "Payment service is unavailable.");
      }
    }
  }

  assertPaymentIsNotPaid(payment);
  ensurePaymentMatchesOrder(payment, price.subtotalCents, price.currency, stripeLivemode);

  const stripe = getStripeClient(dependencies);
  if (payment.payment_status === "checkout_open") {
    const reusableCheckout = await reuseOrExpireOpenCheckout({
      payment,
      repository: dependencies.repository,
      stripe,
      now: now(),
    });
    if (reusableCheckout) return reusableCheckout;

    payment = await dependencies.repository.getPayment(order.id);
    if (!payment) {
      throw new CheckoutServiceError(502, "payment-storage", "Payment service is unavailable.");
    }
    assertPaymentIsNotPaid(payment);
    ensurePaymentMatchesOrder(payment, price.subtotalCents, price.currency, stripeLivemode);
  }

  assertPaymentIsNotPaid(payment);
  const attempt = await reserveOrRetryAttempt({
    payment,
    repository: dependencies.repository,
    now: now(),
  });

  let session: CheckoutSession;
  try {
    session = await stripe.checkout.sessions.create(
      buildCheckoutSessionParams(order, price.subtotalCents),
      { idempotencyKey: getCheckoutIdempotencyKey(payment.id, attempt) },
    );
  } catch {
    await failAttemptSafely(dependencies.repository, payment.id, attempt);
    throw new CheckoutServiceError(502, "stripe-unavailable", "Payment service is temporarily unavailable.");
  }

  if (!session.id || !session.url || session.livemode !== stripeLivemode) {
    await failAttemptSafely(dependencies.repository, payment.id, attempt);
    throw new CheckoutServiceError(502, "stripe-invalid-session", "Payment service is temporarily unavailable.");
  }

  try {
    const markedOpen = await dependencies.repository.markCheckoutOpen({
      paymentId: payment.id,
      attempt,
      stripeCheckoutSessionId: session.id,
      stripeLivemode,
      checkoutExpiresAt: toIsoDate(session.expires_at),
    });
    if (!markedOpen) {
      await throwForConditionalMutationNoOp(
        dependencies.repository,
        order.id,
        "checkout-state-conflict",
      );
    }
  } catch (error) {
    // The persisted attempt and stable Stripe idempotency key mean a later
    // retry reuses this same creation attempt instead of producing an
    // unbounded number of Checkout Sessions after a database failure.
    if (error instanceof CheckoutRepositoryError) {
      throw new CheckoutServiceError(502, "payment-storage", "Payment service is unavailable.");
    }
    throw error;
  }

  return { url: session.url };
}

function toServiceError<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof CheckoutEligibilityError) {
      throw new CheckoutServiceError(
        error.kind === "conflict" ? 409 : 422,
        `eligibility-${error.kind}`,
        error.message,
      );
    }
    throw error;
  }
}

function getStripeMode(dependencies: CheckoutServiceDependencies): "test" | "live" {
  try {
    return (dependencies.getStripeMode ?? (() => getStripeApiConfig().mode))();
  } catch {
    throw new CheckoutServiceError(503, "stripe-not-configured", "Payment service is not configured.");
  }
}

function getStripeClient(dependencies: CheckoutServiceDependencies): CheckoutStripeClient {
  try {
    return (dependencies.getStripeClient ?? getStripeServerClient)() as CheckoutStripeClient;
  } catch {
    throw new CheckoutServiceError(503, "stripe-not-configured", "Payment service is not configured.");
  }
}

function ensurePaymentMatchesOrder(
  payment: OrderPaymentRecord,
  subtotalCents: number,
  currency: string,
  stripeLivemode: boolean,
): void {
  if (payment.subtotal_cents !== subtotalCents || payment.currency !== currency) {
    throw new CheckoutServiceError(
      409,
      "payment-snapshot-mismatch",
      "The stored payment cannot be used for this order.",
    );
  }
  if (
    payment.stripe_livemode !== null &&
    payment.stripe_livemode !== stripeLivemode
  ) {
    throw new CheckoutServiceError(
      409,
      "stripe-mode-mismatch",
      "The stored payment cannot be used in this environment.",
    );
  }
}

export function isPaymentPaid(payment: OrderPaymentRecord): boolean {
  return payment.payment_status === "paid" || payment.paid_at !== null;
}

function assertPaymentIsNotPaid(payment: OrderPaymentRecord): void {
  if (isPaymentPaid(payment)) {
    throw new CheckoutServiceError(409, "payment-paid", "This order has already been paid.");
  }
}

async function throwForConditionalMutationNoOp(
  repository: CheckoutRepository,
  orderId: string,
  code: string,
): Promise<never> {
  const currentPayment = await repository.getPayment(orderId);
  if (currentPayment && isPaymentPaid(currentPayment)) {
    assertPaymentIsNotPaid(currentPayment);
  }
  throw new CheckoutServiceError(502, code, "Payment service is temporarily unavailable.");
}

async function reuseOrExpireOpenCheckout({
  payment,
  repository,
  stripe,
  now,
}: {
  payment: OrderPaymentRecord;
  repository: CheckoutRepository;
  stripe: CheckoutStripeClient;
  now: Date;
}): Promise<CreateCheckoutSessionResult | null> {
  if (!payment.stripe_checkout_session_id) {
    throw new CheckoutServiceError(409, "checkout-state-invalid", "Payment is being processed.");
  }

  let session: CheckoutSession;
  try {
    session = await stripe.checkout.sessions.retrieve(payment.stripe_checkout_session_id);
  } catch {
    throw new CheckoutServiceError(502, "stripe-unavailable", "Payment service is temporarily unavailable.");
  }

  const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
  if (session.status === "open" && session.url && (!expiresAt || expiresAt > now)) {
    const currentPayment = await repository.getPayment(payment.order_id);
    if (currentPayment) assertPaymentIsNotPaid(currentPayment);
    return { url: session.url };
  }

  if (session.status === "expired" || (expiresAt && expiresAt <= now)) {
    try {
      const markedExpired = await repository.markExpired({
        paymentId: payment.id,
        stripeCheckoutSessionId: payment.stripe_checkout_session_id,
        attempt: payment.checkout_attempt,
      });
      if (!markedExpired) {
        await throwForConditionalMutationNoOp(
          repository,
          payment.order_id,
          "checkout-state-conflict",
        );
      }
    } catch (error) {
      if (error instanceof CheckoutServiceError) throw error;
      throw new CheckoutServiceError(502, "payment-storage", "Payment service is unavailable.");
    }
    return null;
  }

  // A completed Session may be waiting for webhook processing. Never create a
  // second session or infer that it is paid from a browser-visible redirect.
  throw new CheckoutServiceError(409, "checkout-processing", "Payment is being processed.");
}

async function reserveOrRetryAttempt({
  payment,
  repository,
  now,
}: {
  payment: OrderPaymentRecord;
  repository: CheckoutRepository;
  now: Date;
}): Promise<number> {
  assertPaymentIsNotPaid(payment);
  if (
    payment.payment_status !== "pending" &&
    payment.payment_status !== "expired" &&
    payment.payment_status !== "failed"
  ) {
    throw new CheckoutServiceError(409, "checkout-state-invalid", "Payment is being processed.");
  }

  const reservedUntil = payment.checkout_expires_at
    ? new Date(payment.checkout_expires_at)
    : null;

  if (reservedUntil && reservedUntil > now) {
    throw new CheckoutServiceError(409, "checkout-in-progress", "Payment is being prepared.");
  }

  // A stale pending reservation can be retried with the same stable attempt
  // key after a database write failure. The conditional write still proves it
  // has not become paid before another Stripe call is allowed.
  const nextAttempt =
    payment.payment_status === "pending" && payment.checkout_attempt > 0
      ? payment.checkout_attempt
      : payment.checkout_attempt + 1;
  const reserved = await repository.reserveAttempt({
    paymentId: payment.id,
    expectedAttempt: payment.checkout_attempt,
    nextAttempt,
    leaseExpiresAt: new Date(now.getTime() + ATTEMPT_LEASE_MS).toISOString(),
  });
  if (!reserved) {
    const currentPayment = await repository.getPayment(payment.order_id);
    if (currentPayment) assertPaymentIsNotPaid(currentPayment);
    throw new CheckoutServiceError(409, "checkout-in-progress", "Payment is being prepared.");
  }
  return nextAttempt;
}

async function failAttemptSafely(
  repository: CheckoutRepository,
  paymentId: string,
  attempt: number,
): Promise<void> {
  try {
    await repository.markFailed({ paymentId, attempt });
  } catch {
    // The public error stays sanitized. A retained attempt remains safe because
    // retries use the same idempotency key.
  }
}

function buildCheckoutSessionParams(
  order: CheckoutEligibleOrder,
  subtotalCents: number,
): CheckoutSessionCreateParams {
  const orderId = order.id;
  const orderNumber = order.order_number;
  const customerEmail = trustedEmail(order.client_email);

  return {
    mode: "payment",
    payment_method_types: ["card"],
    automatic_tax: { enabled: true },
    allow_promotion_codes: false,
    client_reference_id: orderId,
    customer_email: customerEmail ?? undefined,
    success_url: absoluteUrl(
      `/dashboard/jobs/${encodeURIComponent(orderId)}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    ),
    cancel_url: absoluteUrl(
      `/dashboard/jobs/${encodeURIComponent(orderId)}?payment=cancelled`,
    ),
    metadata: {
      picchuspot_order_id: orderId,
      picchuspot_order_number: orderNumber,
    },
    payment_intent_data: {
      metadata: {
        picchuspot_order_id: orderId,
        picchuspot_order_number: orderNumber,
      },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: subtotalCents,
          product_data: { name: `PicchuSpot order ${orderNumber}` },
        },
      },
    ],
  };
}

function trustedEmail(value: string | null): string | null {
  const email = value?.trim() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function getCheckoutIdempotencyKey(paymentId: string, attempt: number): string {
  return `picchuspot-checkout-${paymentId}-${attempt}`;
}

function toIsoDate(epochSeconds: number | null): string | null {
  return epochSeconds ? new Date(epochSeconds * 1000).toISOString() : null;
}

export const checkoutInternals = {
  buildCheckoutSessionParams,
  getCheckoutIdempotencyKey,
};
