import "server-only";

import { CheckoutServiceError, createCheckoutSession } from "./checkout-service.ts";
import type { CheckoutServiceDependencies } from "./checkout-service.ts";

export interface CheckoutRequestUser {
  id: string;
}

export interface CheckoutRequestDependencies extends CheckoutServiceDependencies {
  getAuthenticatedUser: () => Promise<CheckoutRequestUser | null>;
}

export interface CheckoutRouteResult {
  status: number;
  body: { url: string } | { error: string; state?: "processing" };
}

/** Keeps the App Router handler thin and makes request validation testable. */
export async function handleCheckoutRequest(
  body: unknown,
  dependencies: CheckoutRequestDependencies,
): Promise<CheckoutRouteResult> {
  const user = await dependencies.getAuthenticatedUser();
  if (!user) {
    return { status: 401, body: { error: "Unauthorized." } };
  }

  const orderId = parseOrderId(body);
  if (!orderId) {
    return { status: 400, body: { error: "Invalid request." } };
  }

  try {
    const result = await createCheckoutSession(
      { orderId, authenticatedUserId: user.id },
      dependencies,
    );
    return { status: 200, body: result };
  } catch (error) {
    if (error instanceof CheckoutServiceError) {
      // Do not include provider/database data, configuration values, or order
      // details in the response. The error code is intentionally safe enough
      // for minimal server-side diagnostics.
      console.error("[payments/checkout]", error.code);
      return {
        status: error.status,
        body: {
          error: error.message,
          ...(error.code === "checkout-processing"
            ? { state: "processing" as const }
            : {}),
        },
      };
    }

    console.error("[payments/checkout] unexpected failure");
    return { status: 502, body: { error: "Payment service is temporarily unavailable." } };
  }
}

function parseOrderId(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).length !== 1 || typeof body.orderId !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    body.orderId,
  )
    ? body.orderId
    : null;
}
