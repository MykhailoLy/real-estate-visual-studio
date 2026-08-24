import "server-only";

import {
  processVerifiedStripeWebhook,
  type StripeWebhookServiceDependencies,
  type VerifiedStripeWebhookEvent,
} from "./webhook-service.ts";

const PAID_CHECKOUT_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

export interface StripeWebhookRequestDependencies extends StripeWebhookServiceDependencies {
  getWebhookSecret: () => string;
  verifyEvent: (
    rawBody: string,
    signature: string,
    webhookSecret: string,
  ) => VerifiedStripeWebhookEvent;
  enqueuePaymentConfirmationEmail?: (orderId: string) => Promise<boolean>;
  dispatchOrderEmailOutbox?: (orderId: string) => Promise<void>;
}

export async function handleStripeWebhookRequest(
  input: { rawBody: string; stripeSignature: string | null },
  dependencies: StripeWebhookRequestDependencies,
): Promise<{ status: 200 | 400 | 500 | 503; body: { received: true } }> {
  if (!input.stripeSignature) return { status: 400, body: { received: true } };

  let webhookSecret: string;
  try {
    webhookSecret = dependencies.getWebhookSecret();
  } catch {
    return { status: 503, body: { received: true } };
  }

  let event: VerifiedStripeWebhookEvent;
  try {
    event = dependencies.verifyEvent(input.rawBody, input.stripeSignature, webhookSecret);
  } catch {
    // Do not disclose signature details or payload content.
    return { status: 400, body: { received: true } };
  }

  try {
    const result = await processVerifiedStripeWebhook(event, dependencies);
    if (result.status === 200) {
      await enqueueAndDispatchPaymentConfirmationIfProcessed(event, dependencies);
    }
    return result;
  } catch {
    return { status: 500, body: { received: true } };
  }
}

async function enqueueAndDispatchPaymentConfirmationIfProcessed(
  event: VerifiedStripeWebhookEvent,
  dependencies: StripeWebhookRequestDependencies,
): Promise<void> {
  if (
    !dependencies.enqueuePaymentConfirmationEmail ||
    typeof event.id !== "string" ||
    typeof event.type !== "string" ||
    !PAID_CHECKOUT_EVENT_TYPES.has(event.type)
  ) {
    return;
  }

  const storedEvent = await dependencies.repository.getEvent(event.id);
  if (
    storedEvent?.processing_status !== "processed" ||
    typeof storedEvent.order_id !== "string"
  ) {
    return;
  }

  // Enqueue failure is deliberately allowed to propagate so Stripe receives a
  // 500 and retries the webhook. Replays are safe because both the event and
  // delivery rows are idempotent.
  const enqueued = await dependencies.enqueuePaymentConfirmationEmail(
    storedEvent.order_id,
  );
  if (!enqueued || !dependencies.dispatchOrderEmailOutbox) return;

  try {
    await dependencies.dispatchOrderEmailOutbox(storedEvent.order_id);
  } catch {
    // The durable row already exists. Provider delivery is best-effort in this
    // request and can be retried later by the existing outbox worker.
    console.error("[payment-confirmation-email] immediate dispatch failed");
  }
}
