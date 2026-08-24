import { NextResponse } from "next/server";
import { dispatchOrderEmailOutbox } from "@/lib/email/send-order-emails";
import { handleStripeWebhookRequest } from "@/lib/payments/webhook-request";
import {
  createSupabaseWebhookRepository,
  type WebhookRepository,
} from "@/lib/payments/webhook-repository";
import { getStripeServerClient, getStripeWebhookConfig } from "@/lib/payments/stripe-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  let repository: WebhookRepository | null = null;
  const result = await handleStripeWebhookRequest(
    { rawBody, stripeSignature: request.headers.get("stripe-signature") },
    {
      getWebhookSecret: () => {
        const webhookSecret = getStripeWebhookConfig().webhookSecret;
        // Initialize both local configuration paths before treating a later
        // constructEvent error as an invalid signature.
        getStripeServerClient();
        return webhookSecret;
      },
      verifyEvent: (payload, signature, webhookSecret) =>
        getStripeServerClient().webhooks.constructEvent(payload, signature, webhookSecret),
      retrieveCharge: (chargeId) =>
        getStripeServerClient().charges.retrieve(chargeId),
      dispatchOrderEmailOutbox: async (orderId) => {
        await dispatchOrderEmailOutbox({
          supabase: getSupabaseAdminClient(),
          orderId,
          limit: 3,
        });
      },
      get repository() {
        repository ??= createSupabaseWebhookRepository(getSupabaseAdminClient());
        return repository;
      },
    },
  );
  return NextResponse.json(result.body, { status: result.status });
}
