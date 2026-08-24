import "server-only";

import type {
  StripeWebhookEventRecord,
  WebhookPaymentRecord,
  WebhookRepository,
} from "./webhook-repository.ts";

const CHECKOUT_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);
const REFUND_EVENT_TYPES = new Set([
  "refund.created",
  "refund.updated",
  "refund.failed",
  "charge.refunded",
]);
const HANDLED_EVENT_TYPES = new Set([
  ...CHECKOUT_EVENT_TYPES,
  ...REFUND_EVENT_TYPES,
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRANSIENT_ERROR_MESSAGE = "Payment webhook processing could not be completed.";

export interface StripeWebhookCheckoutSession {
  id?: unknown;
  object?: unknown;
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
  amount?: unknown;
  amount_refunded?: unknown;
  charge?: unknown;
  refunded?: unknown;
  paid?: unknown;
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
  retrieveCharge: (chargeId: string) => Promise<StripeWebhookCheckoutSession>;
  now?: () => Date;
}

export interface StripeWebhookResult {
  status: 200 | 500;
  body: { received: true };
}

class PermanentWebhookError extends Error {}

/**
 * Processes only already-verified Stripe events. Raw event data never reaches
 * storage, and event rows are linked to orders only after a payment lookup
 * proves the metadata UUID belongs to an existing payment record.
 */
export async function processVerifiedStripeWebhook(
  event: VerifiedStripeWebhookEvent,
  dependencies: StripeWebhookServiceDependencies,
): Promise<StripeWebhookResult> {
  const now = dependencies.now ?? (() => new Date());
  const normalized = normalizeEvent(event);
  if (!normalized) return received(200);

  let existing: StripeWebhookEventRecord | null;
  try {
    existing = await dependencies.repository.registerEvent({
      stripeEventId: normalized.id,
      eventType: normalized.type,
      stripeLivemode: normalized.livemode,
      stripeObjectId: normalized.sessionId,
      stripeCreatedAt: normalized.createdAt,
      receivedAt: now().toISOString(),
    });
    if (!existing) {
      existing = await dependencies.repository.getEvent(normalized.id);
      if (!existing) throw new Error("Webhook event could not be reloaded.");
      if (isFinalEvent(existing)) return received(200);
    }
  } catch {
    return received(500);
  }

  let linkedOrderId: string | null = null;
  try {
    if (!HANDLED_EVENT_TYPES.has(normalized.type)) {
      await finishTerminal(
        dependencies.repository,
        normalized.id,
        "ignored",
        null,
        null,
        now(),
      );
      return received(200);
    }

    if (CHECKOUT_EVENT_TYPES.has(normalized.type)) {
      const verifiedOrderId = getPicchuSpotOrderId(normalized.session);
      if (!verifiedOrderId) {
        await finishTerminal(
          dependencies.repository,
          normalized.id,
          "ignored",
          null,
          linkedOrderId,
          now(),
        );
        return received(200);
      }

      const payment = await dependencies.repository.getPayment(verifiedOrderId);
      if (!payment) throw new Error("Payment record is unavailable.");
      if (payment.order_id !== verifiedOrderId) {
        throw new PermanentWebhookError("Payment order does not match verified Checkout metadata.");
      }
      linkedOrderId = payment.order_id;
      assertPaymentMatchesSession(payment, normalized);

      if (normalized.type === "checkout.session.completed") {
        if (normalized.session.payment_status !== "paid") {
          await finishTerminal(
            dependencies.repository,
            normalized.id,
            "ignored",
            null,
            linkedOrderId,
            now(),
          );
          return received(200);
        }
        await processPaidEvent(payment, normalized, dependencies.repository);
      } else if (normalized.type === "checkout.session.async_payment_succeeded") {
        await processPaidEvent(payment, normalized, dependencies.repository);
      } else if (normalized.type === "checkout.session.async_payment_failed") {
        await processFailedEvent(payment, normalized, dependencies.repository);
      } else {
        await processExpiredEvent(payment, normalized, dependencies.repository);
      }
    } else {
      const paymentIntentId = extractStripeId(normalized.session.payment_intent);
      if (!paymentIntentId) {
        await finishTerminal(
          dependencies.repository,
          normalized.id,
          "ignored",
          null,
          null,
          now(),
        );
        return received(200);
      }

      const payment = await dependencies.repository.getPaymentByPaymentIntent(
        paymentIntentId,
      );
      if (!payment) {
        await finishTerminal(
          dependencies.repository,
          normalized.id,
          "ignored",
          null,
          null,
          now(),
        );
        return received(200);
      }
      linkedOrderId = payment.order_id;

      if (normalized.type === "charge.refunded") {
        await processChargeRefundedEvent(payment, normalized, dependencies.repository);
      } else {
        await processRefundObjectEvent(payment, normalized, dependencies);
      }
    }

    await finishTerminal(
      dependencies.repository,
      normalized.id,
      "processed",
      null,
      linkedOrderId,
      now(),
    );
    return received(200);
  } catch (error) {
    if (error instanceof PermanentWebhookError) {
      try {
        await finishTerminal(
          dependencies.repository,
          normalized.id,
          "failed",
          sanitizePermanentError(error),
          linkedOrderId,
          now(),
        );
        return received(200);
      } catch {
        return received(500);
      }
    }

    try {
      const terminalStateWon = await finishTransientFailure(
        dependencies.repository,
        normalized.id,
        linkedOrderId,
      );
      return received(terminalStateWon ? 200 : 500);
    } catch {
      return received(500);
    }
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

interface PaymentMatch {
  orderId: string;
  livemode: boolean;
  currency: string;
  subtotalCents: number;
  sessionId: string;
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
): PaymentMatch {
  const sessionId = optionalId(event.session.id);
  const currency = normalizeCurrency(event.session.currency);
  const subtotal = safeAmount(event.session.amount_subtotal);
  if (
    !sessionId ||
    !currency ||
    subtotal === null ||
    typeof event.session.livemode !== "boolean" ||
    event.session.livemode !== event.livemode ||
    payment.provider !== "stripe" ||
    payment.stripe_livemode !== event.livemode ||
    payment.currency !== currency ||
    payment.subtotal_cents !== subtotal ||
    (payment.stripe_checkout_session_id !== null &&
      payment.stripe_checkout_session_id !== sessionId)
  ) {
    throw new PermanentWebhookError("Payment does not match its Checkout Session.");
  }
  return {
    orderId: payment.order_id,
    livemode: event.livemode,
    currency,
    subtotalCents: subtotal,
    sessionId,
  };
}

async function processPaidEvent(
  payment: WebhookPaymentRecord,
  event: NormalizedEvent,
  repository: WebhookRepository,
): Promise<void> {
  const match = assertPaymentMatchesSession(payment, event);
  const session = event.session;
  const paymentIntentId = requiredId(
    extractStripeId(session.payment_intent),
    "Payment Intent is required for a paid Checkout Session.",
  );
  const customerId = extractStripeId(session.customer);
  const tax = readAmountDetail(session.total_details, "amount_tax");
  const discount = readAmountDetail(session.total_details, "amount_discount");
  const shipping = readAmountDetail(session.total_details, "amount_shipping");
  const total = safeAmount(session.amount_total);
  if (
    session.payment_status !== "paid" ||
    session.status !== "complete" ||
    tax === null ||
    discount === null ||
    shipping === null ||
    total === null ||
    discount !== 0 ||
    shipping !== 0 ||
    total !== match.subtotalCents
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
    stripeCheckoutSessionId: match.sessionId,
    stripePaymentIntentId: paymentIntentId,
    stripeCustomerId: customerId,
    taxCents: tax,
    totalCents: total,
    paidAt,
  });
  if (updated) return;

  const current = await repository.getPayment(payment.order_id);
  if (isSamePaidPayment(current, {
    ...match,
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
  const match = assertPaymentMatchesSession(payment, event);
  const paymentIntentId = extractStripeId(event.session.payment_intent);
  assertPaymentIntentMatches(payment, paymentIntentId);
  if (isPaid(payment)) return;
  const updated = await repository.markFailed({
    payment,
    stripeCheckoutSessionId: match.sessionId,
    stripePaymentIntentId: paymentIntentId,
  });
  if (updated) return;
  const current = await repository.getPayment(payment.order_id);
  if (
    isPaidWithMatchingCore(current, match, paymentIntentId) ||
    isSameTerminalSession(current, "failed", match, paymentIntentId)
  ) return;
  throw new PermanentWebhookError("Payment state conflicts with a failed Checkout Session.");
}

async function processExpiredEvent(
  payment: WebhookPaymentRecord,
  event: NormalizedEvent,
  repository: WebhookRepository,
): Promise<void> {
  const match = assertPaymentMatchesSession(payment, event);
  const paymentIntentId = extractStripeId(event.session.payment_intent);
  assertPaymentIntentMatches(payment, paymentIntentId);
  if (isPaid(payment)) return;
  const updated = await repository.markExpired({
    payment,
    stripeCheckoutSessionId: match.sessionId,
    stripePaymentIntentId: paymentIntentId,
  });
  if (updated) return;
  const current = await repository.getPayment(payment.order_id);
  if (
    isPaidWithMatchingCore(current, match, paymentIntentId) ||
    isSameTerminalSession(current, "expired", match, paymentIntentId)
  ) return;
  throw new PermanentWebhookError("Payment state conflicts with an expired Checkout Session.");
}

interface RefundObjectMatch {
  chargeId: string;
  status: "pending" | "requires_action" | "succeeded" | "failed" | "canceled";
}

interface RefundChargeMatch {
  paymentIntentId: string;
  refundedAmountCents: number;
  totalCents: number;
}

async function processRefundObjectEvent(
  payment: WebhookPaymentRecord,
  event: NormalizedEvent,
  dependencies: StripeWebhookServiceDependencies,
): Promise<void> {
  const refund = assertRefundObjectMatchesPayment(payment, event);

  if (event.type === "refund.failed") {
    if (refund.status !== "failed") {
      throw new PermanentWebhookError("Failed refund event has an inconsistent status.");
    }
    // Failed refunds are operational events only. The persisted aggregate
    // continues to describe money successfully refunded to the customer.
    return;
  }

  if (refund.status !== "succeeded") return;

  const charge = await dependencies.retrieveCharge(refund.chargeId);
  const chargeMatch = assertChargeMatchesPayment(
    payment,
    event,
    charge,
    refund.chargeId,
  );
  await syncSuccessfulRefund(payment, chargeMatch, event, dependencies.repository);
}

async function processChargeRefundedEvent(
  payment: WebhookPaymentRecord,
  event: NormalizedEvent,
  repository: WebhookRepository,
): Promise<void> {
  const chargeMatch = assertChargeMatchesPayment(
    payment,
    event,
    event.session,
    requiredId(event.session.id, "Refunded Charge ID is required."),
  );
  if (chargeMatch.refundedAmountCents <= 0) {
    throw new PermanentWebhookError("Refunded Charge has no successful refund amount.");
  }
  await syncSuccessfulRefund(payment, chargeMatch, event, repository);
}

function assertRefundObjectMatchesPayment(
  payment: WebhookPaymentRecord,
  event: NormalizedEvent,
): RefundObjectMatch {
  const refund = event.session;
  const refundId = requiredId(refund.id, "Refund ID is required.");
  const chargeId = requiredId(
    extractStripeId(refund.charge),
    "Refund Charge ID is required.",
  );
  const paymentIntentId = requiredId(
    extractStripeId(refund.payment_intent),
    "Refund Payment Intent is required.",
  );
  const currency = normalizeCurrency(refund.currency);
  const amount = safeAmount(refund.amount);
  const status = normalizeRefundObjectStatus(refund.status);
  if (
    refund.object !== "refund" ||
    !refundId ||
    !currency ||
    amount === null ||
    amount <= 0 ||
    !status
  ) {
    throw new PermanentWebhookError("Refund event is malformed.");
  }
  const totalCents = assertPaidPaymentForRefund(
    payment,
    event,
    paymentIntentId,
    currency,
  );
  if (amount > totalCents) {
    throw new PermanentWebhookError("Refund amount exceeds the stored payment total.");
  }
  return { chargeId, status };
}

function assertChargeMatchesPayment(
  payment: WebhookPaymentRecord,
  event: NormalizedEvent,
  charge: StripeWebhookCheckoutSession,
  expectedChargeId: string,
): RefundChargeMatch {
  const chargeId = requiredId(charge.id, "Charge ID is required.");
  const paymentIntentId = requiredId(
    extractStripeId(charge.payment_intent),
    "Charge Payment Intent is required.",
  );
  const currency = normalizeCurrency(charge.currency);
  const amount = safeAmount(charge.amount);
  const amountRefunded = safeAmount(charge.amount_refunded);
  const totalCents = currency
    ? assertPaidPaymentForRefund(
        payment,
        event,
        paymentIntentId,
        currency,
      )
    : null;
  if (
    charge.object !== "charge" ||
    chargeId !== expectedChargeId ||
    typeof charge.livemode !== "boolean" ||
    charge.livemode !== event.livemode ||
    charge.paid !== true ||
    charge.status !== "succeeded" ||
    !currency ||
    amount === null ||
    amountRefunded === null ||
    totalCents === null ||
    amount !== totalCents ||
    amountRefunded > amount ||
    charge.refunded !== (amountRefunded === amount)
  ) {
    throw new PermanentWebhookError("Charge refund does not match the stored payment.");
  }
  return {
    paymentIntentId,
    refundedAmountCents: amountRefunded,
    totalCents,
  };
}

function assertPaidPaymentForRefund(
  payment: WebhookPaymentRecord,
  event: NormalizedEvent,
  paymentIntentId: string,
  currency: string,
): number {
  const totalCents = safeAmount(payment.total_cents);
  if (
    payment.provider !== "stripe" ||
    payment.payment_status !== "paid" ||
    payment.paid_at === null ||
    !payment.stripe_checkout_session_id ||
    payment.stripe_payment_intent_id !== paymentIntentId ||
    payment.stripe_livemode !== event.livemode ||
    payment.currency !== currency ||
    totalCents === null ||
    totalCents <= 0 ||
    payment.subtotal_cents !== totalCents
  ) {
    throw new PermanentWebhookError("Refund does not match a verified Paid payment.");
  }
  assertStoredRefundAggregate(payment, totalCents);
  return totalCents;
}

async function syncSuccessfulRefund(
  payment: WebhookPaymentRecord,
  charge: RefundChargeMatch,
  event: NormalizedEvent,
  repository: WebhookRepository,
): Promise<void> {
  if (charge.refundedAmountCents <= 0) return;
  if (charge.refundedAmountCents <= payment.refunded_amount_cents) {
    // Webhook delivery order is not guaranteed. Never regress a newer
    // successful aggregate when an older event arrives later.
    return;
  }

  const refundStatus = charge.refundedAmountCents === charge.totalCents
    ? "full"
    : "partial";
  const refundedAt = requiredStripeTimestamp(event.createdAt);
  const updated = await repository.syncRefund({
    payment,
    refundStatus,
    refundedAmountCents: charge.refundedAmountCents,
    refundedAt,
  });
  if (updated) return;

  const current = await repository.getPaymentByPaymentIntent(
    charge.paymentIntentId,
  );
  if (
    current &&
    samePaidPaymentIdentity(current, payment) &&
    current.refunded_amount_cents >= charge.refundedAmountCents
  ) {
    assertStoredRefundAggregate(current, charge.totalCents);
    return;
  }
  throw new PermanentWebhookError("Payment refund state conflicts with the Stripe Charge.");
}

function assertStoredRefundAggregate(
  payment: WebhookPaymentRecord,
  totalCents: number,
): void {
  const amount = safeAmount(payment.refunded_amount_cents);
  const isConsistent =
    amount !== null &&
    ((payment.refund_status === "none" && amount === 0) ||
      (payment.refund_status === "partial" && amount > 0 && amount < totalCents) ||
      (payment.refund_status === "full" && amount === totalCents));
  if (!isConsistent) {
    throw new PermanentWebhookError("Stored refund aggregate is inconsistent.");
  }
}

function samePaidPaymentIdentity(
  current: WebhookPaymentRecord,
  expected: WebhookPaymentRecord,
): boolean {
  return current.id === expected.id &&
    current.order_id === expected.order_id &&
    current.provider === "stripe" &&
    current.payment_status === "paid" &&
    current.paid_at !== null &&
    current.stripe_checkout_session_id === expected.stripe_checkout_session_id &&
    current.stripe_payment_intent_id === expected.stripe_payment_intent_id &&
    current.stripe_livemode === expected.stripe_livemode &&
    current.currency === expected.currency &&
    current.subtotal_cents === expected.subtotal_cents &&
    current.total_cents === expected.total_cents;
}

function normalizeRefundObjectStatus(
  value: unknown,
): RefundObjectMatch["status"] | null {
  return value === "pending" ||
      value === "requires_action" ||
      value === "succeeded" ||
      value === "failed" ||
      value === "canceled"
    ? value
    : null;
}

async function finishTerminal(
  repository: WebhookRepository,
  stripeEventId: string,
  status: "processed" | "ignored" | "failed",
  errorMessage: string | null,
  orderId: string | null,
  now: Date,
): Promise<void> {
  const updated = await repository.finishEvent({
    stripeEventId,
    status,
    processedAt: now.toISOString(),
    errorMessage,
    orderId,
  });
  if (updated) return;
  const current = await repository.getEvent(stripeEventId);
  if (current && isFinalEvent(current)) return;
  throw new Error("Webhook event finalization did not complete.");
}

async function finishTransientFailure(
  repository: WebhookRepository,
  stripeEventId: string,
  orderId: string | null,
): Promise<boolean> {
  const updated = await repository.finishEvent({
    stripeEventId,
    status: "failed",
    processedAt: null,
    errorMessage: TRANSIENT_ERROR_MESSAGE,
    orderId,
  });
  if (updated) return false;
  const current = await repository.getEvent(stripeEventId);
  if (current && isFinalEvent(current)) return true;
  throw new Error("Webhook transient failure could not be stored.");
}

function isFinalEvent(event: StripeWebhookEventRecord): boolean {
  return event.processing_status === "processed" ||
    event.processing_status === "ignored" ||
    (event.processing_status === "failed" && event.processed_at !== null);
}

function assertPaymentIntentMatches(payment: WebhookPaymentRecord, paymentIntentId: string | null): void {
  if (payment.stripe_payment_intent_id !== null && payment.stripe_payment_intent_id !== paymentIntentId) {
    throw new PermanentWebhookError("Payment Intent does not match the stored payment.");
  }
}

function isSamePaidPayment(
  payment: WebhookPaymentRecord | null,
  expected: PaymentMatch & {
    paymentIntentId: string;
    customerId: string | null;
    tax: number;
    total: number;
  },
): boolean {
  return Boolean(
    payment &&
      payment.provider === "stripe" &&
      payment.order_id === expected.orderId &&
      payment.stripe_livemode === expected.livemode &&
      payment.currency === expected.currency &&
      payment.subtotal_cents === expected.subtotalCents &&
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
  expected: PaymentMatch,
  paymentIntentId: string | null,
): boolean {
  return Boolean(
    payment &&
      payment.provider === "stripe" &&
      payment.order_id === expected.orderId &&
      payment.stripe_livemode === expected.livemode &&
      payment.currency === expected.currency &&
      payment.subtotal_cents === expected.subtotalCents &&
      payment.payment_status === status &&
      payment.stripe_checkout_session_id === expected.sessionId &&
      payment.stripe_payment_intent_id === paymentIntentId,
  );
}

function isPaidWithMatchingCore(
  payment: WebhookPaymentRecord | null,
  expected: PaymentMatch,
  paymentIntentId: string | null,
): boolean {
  return Boolean(
    payment &&
      isPaid(payment) &&
      payment.provider === "stripe" &&
      payment.order_id === expected.orderId &&
      payment.stripe_livemode === expected.livemode &&
      payment.currency === expected.currency &&
      payment.subtotal_cents === expected.subtotalCents &&
      payment.stripe_checkout_session_id === expected.sessionId &&
      (paymentIntentId === null || payment.stripe_payment_intent_id === paymentIntentId),
  );
}

function isPaid(payment: WebhookPaymentRecord | null): boolean {
  return payment?.payment_status === "paid" || payment?.paid_at !== null;
}

function sanitizePermanentError(error: PermanentWebhookError): string {
  return error.message.slice(0, 180);
}

function received(status: 200 | 500): StripeWebhookResult {
  return { status, body: { received: true } };
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
