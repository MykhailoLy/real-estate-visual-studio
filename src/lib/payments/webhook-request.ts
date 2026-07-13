import "server-only";

import {
  processVerifiedStripeWebhook,
  type StripeWebhookServiceDependencies,
  type VerifiedStripeWebhookEvent,
} from "./webhook-service.ts";

export interface StripeWebhookRequestDependencies extends StripeWebhookServiceDependencies {
  getWebhookSecret: () => string;
  verifyEvent: (
    rawBody: string,
    signature: string,
    webhookSecret: string,
  ) => VerifiedStripeWebhookEvent;
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
    return await processVerifiedStripeWebhook(event, dependencies);
  } catch {
    return { status: 500, body: { received: true } };
  }
}
