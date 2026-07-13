export interface StripeRuntimeEnvironment {
  readonly [name: string]: string | undefined;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

export type StripeApiMode = "test" | "live";

export interface StripeApiConfig {
  secretKey: string;
  mode: StripeApiMode;
}

export interface StripeWebhookConfig {
  webhookSecret: string;
}

export class StripeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeConfigurationError";
  }
}

const STRIPE_SERVER_KEY_PATTERN = /^(?:sk|rk)_(test|live)_[A-Za-z0-9]+$/;
const STRIPE_WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9]+$/;

/**
 * Validates a Stripe secret or restricted server key without logging or
 * including the supplied value in any error message.
 */
export function parseStripeApiConfig(
  env: StripeRuntimeEnvironment,
): StripeApiConfig {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new StripeConfigurationError(
      "Stripe is not configured: STRIPE_SECRET_KEY is required.",
    );
  }

  const match = STRIPE_SERVER_KEY_PATTERN.exec(secretKey);
  if (!match) {
    throw new StripeConfigurationError(
      "Stripe is not configured: STRIPE_SECRET_KEY must be a Stripe server key.",
    );
  }

  return {
    secretKey,
    mode: match[1] as StripeApiMode,
  };
}

/**
 * Validates the Stripe endpoint signing secret separately from API-key setup.
 */
export function parseStripeWebhookConfig(
  env: StripeRuntimeEnvironment,
): StripeWebhookConfig {
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new StripeConfigurationError(
      "Stripe is not configured: STRIPE_WEBHOOK_SECRET is required.",
    );
  }

  if (!STRIPE_WEBHOOK_SECRET_PATTERN.test(webhookSecret)) {
    throw new StripeConfigurationError(
      "Stripe is not configured: STRIPE_WEBHOOK_SECRET must begin with whsec_.",
    );
  }

  return { webhookSecret };
}
