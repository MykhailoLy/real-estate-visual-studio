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
      await dispatchPaymentConfirmationIfProcessed(event, dependencies);
    }
    return result;
  } catch {
    return { status: 500, body: { received: true } };
  }
}

async function dispatchPaymentConfirmationIfProcessed(
  event: VerifiedStripeWebhookEvent,
  dependencies: StripeWebhookRequestDependencies,
): Promise<void> {
  if (
    !dependencies.dispatchOrderEmailOutbox ||
    typeof event.id !== "string" ||
    typeof event.type !== "string" ||
    !PAID_CHECKOUT_EVENT_TYPES.has(event.type)
  ) {
    return;
  }

  try {
    const storedEvent = await dependencies.repository.getEvent(event.id);
    if (
      storedEvent?.processing_status === "processed" &&
      typeof storedEvent.order_id === "string"
    ) {
      await dependencies.dispatchOrderEmailOutbox(storedEvent.order_id);
    }
  } catch {
    // Payment state and its durable outbox row are already persisted. Email
    // delivery is best-effort here and can be retried by the outbox worker.
    console.error("[payment-confirmation-email] immediate dispatch failed");
  }
}
