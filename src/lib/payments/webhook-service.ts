import "server-only";

import type { WebhookPaymentRecord, WebhookRepository } from "./webhook-repository.ts";

const HANDLED_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface StripeWebhookCheckoutSession {
  id?: unknown;
  client_reference_id?: unknown;
  metadata?: unknown;
  livemode?: unknown;
  currency?: unknown;
  amount_subtotal?: unknown;
  amount_total?: unknown;
  payment_status?: unknown;
  status?: unknown;
  payment_intent?: unknown;
  customer?: unknown;
  total_details?: unknown;
}

export interface VerifiedStripeWebhookEvent {
  id?: unknown;
  type?: unknown;
  livemode?: unknown;
  created?: unknown;
  data?: { object?: unknown };
}

export interface StripeWebhookServiceDependencies {
  repository: WebhookRepository;
  now?: () => Date;
}

export interface StripeWebhookResult {
  status: 200 | 500;
  body: { received: true };
}

class PermanentWebhookError extends Error {}

/**
 * Processes only already-verified Stripe events. It persists reconciliation
 * metadata, never raw payloads, and performs no Stripe API calls.
 */
export async function processVerifiedStripeWebhook(
  event: VerifiedStripeWebhookEvent,
  dependencies: StripeWebhookServiceDependencies,
): Promise<StripeWebhookResult> {
  const now = dependencies.now ?? (() => new Date());
  const normalized = normalizeEvent(event);
  if (!normalized) return { status: 200, body: { received: true } };

  const identity = getPicchuSpotOrderId(normalized.session);
  let registered;
  try {
    registered = await dependencies.repository.registerEvent({
      stripeEventId: normalized.id,
      eventType: normalized.type,
      stripeLivemode: normalized.livemode,
      stripeObjectId: normalized.sessionId,
      orderId: identity,
      stripeCreatedAt: normalized.createdAt,
      receivedAt: now().toISOString(),
    });
    if (!registered) {
      const existing = await dependencies.repository.getEvent(normalized.id);
      if (!existing) throw new Error("Missing duplicate webhook event.");
      if (existing.processing_status === "processed" || existing.processing_status === "ignored") {
        return { status: 200, body: { received: true } };
      }
    }
  } catch {
    return { status: 500, body: { received: true } };
  }

  try {
    if (!HANDLED_EVENT_TYPES.has(normalized.type) || !identity) {
      await finishEvent(dependencies.repository, normalized.id, "ignored", null, now());
      return { status: 200, body: { received: true } };
    }

    const payment = await dependencies.repository.getPayment(identity);
    if (!payment) throw new Error("Payment record is unavailable.");
    assertPaymentMatchesSession(payment, normalized);

    if (normalized.type === "checkout.session.completed") {
      if (normalized.session.payment_status !== "paid") {
        await finishEvent(dependencies.repository, normalized.id, "ignored", null, now());
        return { status: 200, body: { received: true } };
      }
      await processPaidEvent(payment, normalized, dependencies.repository);
    } else if (normalized.type === "checkout.session.async_payment_succeeded") {
      await processPaidEvent(payment, normalized, dependencies.repository);
    } else if (normalized.type === "checkout.session.async_payment_failed") {
      await processFailedEvent(payment, normalized, dependencies.repository);
    } else {
      await processExpiredEvent(payment, normalized, dependencies.repository);
    }

    await finishEvent(dependencies.repository, normalized.id, "processed", null, now());
    return { status: 200, body: { received: true } };
  } catch (error) {
    if (error instanceof PermanentWebhookError) {
      try {
        await finishEvent(
          dependencies.repository,
          normalized.id,
          "failed",
          sanitizePermanentError(error),
          now(),
        );
        return { status: 200, body: { received: true } };
      } catch {
        return { status: 500, body: { received: true } };
      }
    }

    try {
      await finishEvent(
        dependencies.repository,
        normalized.id,
        "failed",
        "Payment webhook processing could not be completed.",
        now(),
      );
    } catch {
      // The only safe action is a retry: no payload or provider details leave this boundary.
    }
    return { status: 500, body: { received: true } };
  }
}

interface NormalizedEvent {
  id: string;
  type: string;
  livemode: boolean;
  createdAt: string | null;
  sessionId: string | null;
  session: StripeWebhookCheckoutSession;
}

function normalizeEvent(event: VerifiedStripeWebhookEvent): NormalizedEvent | null {
  if (
    !isNonEmptyString(event.id) ||
    !isNonEmptyString(event.type) ||
    typeof event.livemode !== "boolean" ||
    !isRecord(event.data?.object)
  ) {
    return null;
  }
  return {
    id: event.id,
    type: event.type,
    livemode: event.livemode,
    createdAt: toStripeTimestamp(event.created),
    sessionId: optionalId(event.data.object.id),
    session: event.data.object,
  };
}

function getPicchuSpotOrderId(session: StripeWebhookCheckoutSession): string | null {
  const metadata = isRecord(session.metadata) ? session.metadata : null;
  const metadataOrderId = metadata?.picchuspot_order_id;
  const referenceOrderId = session.client_reference_id;
  if (
    !isUuid(metadataOrderId) ||
    !isUuid(referenceOrderId) ||
    metadataOrderId.toLowerCase() !== referenceOrderId.toLowerCase()
  ) {
    return null;
  }
  return metadataOrderId;
}

function assertPaymentMatchesSession(
  payment: WebhookPaymentRecord,
  event: NormalizedEvent,
): void {
  const sessionId = optionalId(event.session.id);
  const currency = normalizeCurrency(event.session.currency);
  const subtotal = safeAmount(event.session.amount_subtotal);
  if (
    !sessionId ||
    !currency ||
    subtotal === null ||
    payment.provider !== "stripe" ||
    payment.stripe_livemode !== event.livemode ||
    payment.currency !== currency ||
    payment.subtotal_cents !== subtotal ||
    (payment.stripe_checkout_session_id !== null &&
      payment.stripe_checkout_session_id !== sessionId)
  ) {
    throw new PermanentWebhookError("Payment does not match its Checkout Session.");
  }
}

async function processPaidEvent(
  payment: WebhookPaymentRecord,
  event: NormalizedEvent,
  repository: WebhookRepository,
): Promise<void> {
  const session = event.session;
  const sessionId = requiredId(session.id, "Checkout Session ID is invalid.");
  const paymentIntentId = requiredId(
    extractStripeId(session.payment_intent),
    "Payment Intent is required for a paid Checkout Session.",
  );
  const customerId = extractStripeId(session.customer);
  const tax = readAmountDetail(session.total_details, "amount_tax");
  const discount = readAmountDetail(session.total_details, "amount_discount");
  const shipping = readAmountDetail(session.total_details, "amount_shipping");
  const total = safeAmount(session.amount_total);
  const subtotal = safeAmount(session.amount_subtotal);
  if (
    session.payment_status !== "paid" ||
    session.status !== "complete" ||
    tax === null ||
    discount === null ||
    shipping === null ||
    total === null ||
    subtotal === null ||
    discount !== 0 ||
    shipping !== 0 ||
    total !== subtotal + tax ||
    total > Number.MAX_SAFE_INTEGER
  ) {
    throw new PermanentWebhookError("Paid Checkout Session has inconsistent amounts or status.");
  }
  if (
    payment.stripe_payment_intent_id !== null &&
    payment.stripe_payment_intent_id !== paymentIntentId
  ) {
    throw new PermanentWebhookError("Payment Intent does not match the stored payment.");
  }
  const paidAt = requiredStripeTimestamp(event.createdAt);
  const updated = await repository.markPaid({
    payment,
    stripeCheckoutSessionId: sessionId,
    stripePaymentIntentId: paymentIntentId,
    stripeCustomerId: customerId,
    taxCents: tax,
    totalCents: total,
    paidAt,
  });
  if (updated) return;

  const current = await repository.getPayment(payment.order_id);
  if (isSamePaidPayment(current, {
    sessionId,
    paymentIntentId,
    customerId,
    tax,
    total,
  })) return;
  throw new PermanentWebhookError("Payment state conflicts with a paid Checkout Session.");
}

async function processFailedEvent(
  payment: WebhookPaymentRecord,
  event: NormalizedEvent,
  repository: WebhookRepository,
): Promise<void> {
  const sessionId = requiredId(event.session.id, "Checkout Session ID is invalid.");
  const paymentIntentId = extractStripeId(event.session.payment_intent);
  assertPaymentIntentMatches(payment, paymentIntentId);
  if (isPaid(payment)) return;
  const updated = await repository.markFailed({ payment, stripeCheckoutSessionId: sessionId, stripePaymentIntentId: paymentIntentId });
  if (updated) return;
  const current = await repository.getPayment(payment.order_id);
  if (isPaid(current) || isSameTerminalSession(current, "failed", sessionId, paymentIntentId)) return;
  throw new PermanentWebhookError("Payment state conflicts with a failed Checkout Session.");
}

async function processExpiredEvent(
  payment: WebhookPaymentRecord,
  event: NormalizedEvent,
  repository: WebhookRepository,
): Promise<void> {
  const sessionId = requiredId(event.session.id, "Checkout Session ID is invalid.");
  const paymentIntentId = extractStripeId(event.session.payment_intent);
  assertPaymentIntentMatches(payment, paymentIntentId);
  if (isPaid(payment)) return;
  const updated = await repository.markExpired({ payment, stripeCheckoutSessionId: sessionId, stripePaymentIntentId: paymentIntentId });
  if (updated) return;
  const current = await repository.getPayment(payment.order_id);
  if (isPaid(current) || isSameTerminalSession(current, "expired", sessionId, paymentIntentId)) return;
  throw new PermanentWebhookError("Payment state conflicts with an expired Checkout Session.");
}

function assertPaymentIntentMatches(payment: WebhookPaymentRecord, paymentIntentId: string | null): void {
  if (payment.stripe_payment_intent_id !== null && payment.stripe_payment_intent_id !== paymentIntentId) {
    throw new PermanentWebhookError("Payment Intent does not match the stored payment.");
  }
}

function isSamePaidPayment(
  payment: WebhookPaymentRecord | null,
  expected: { sessionId: string; paymentIntentId: string; customerId: string | null; tax: number; total: number },
): boolean {
  return Boolean(
    payment &&
      payment.payment_status === "paid" &&
      payment.paid_at !== null &&
      payment.stripe_checkout_session_id === expected.sessionId &&
      payment.stripe_payment_intent_id === expected.paymentIntentId &&
      payment.stripe_customer_id === expected.customerId &&
      payment.tax_cents === expected.tax &&
      payment.total_cents === expected.total,
  );
}

function isSameTerminalSession(
  payment: WebhookPaymentRecord | null,
  status: "failed" | "expired",
  sessionId: string,
  paymentIntentId: string | null,
): boolean {
  return Boolean(
    payment &&
      payment.payment_status === status &&
      payment.stripe_checkout_session_id === sessionId &&
      payment.stripe_payment_intent_id === paymentIntentId,
  );
}

function isPaid(payment: WebhookPaymentRecord | null): boolean {
  return payment?.payment_status === "paid" || payment?.paid_at !== null;
}

async function finishEvent(
  repository: WebhookRepository,
  stripeEventId: string,
  status: "processed" | "ignored" | "failed",
  errorMessage: string | null,
  now: Date,
): Promise<void> {
  await repository.finishEvent({
    stripeEventId,
    status,
    processedAt: now.toISOString(),
    errorMessage,
  });
}

function sanitizePermanentError(error: PermanentWebhookError): string {
  return error.message.slice(0, 180);
}

function toStripeTimestamp(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return null;
  return new Date(value * 1000).toISOString();
}

function requiredStripeTimestamp(value: string | null): string {
  if (!value) throw new PermanentWebhookError("Stripe event timestamp is invalid.");
  return value;
}

function safeAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function readAmountDetail(value: unknown, key: string): number | null {
  return isRecord(value) ? safeAmount(value[key]) : null;
}

function normalizeCurrency(value: unknown): string | null {
  return typeof value === "string" && /^[a-z]{3}$/i.test(value)
    ? value.toLowerCase()
    : null;
}

function extractStripeId(value: unknown): string | null {
  if (isNonEmptyString(value)) return value;
  return isRecord(value) && isNonEmptyString(value.id) ? value.id : null;
}

function optionalId(value: unknown): string | null {
  return isNonEmptyString(value) ? value : null;
}

function requiredId(value: unknown, message: string): string {
  const id = optionalId(value);
  if (!id) throw new PermanentWebhookError(message);
  return id;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
