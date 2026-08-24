const STRIPE_CHECKOUT_ORIGIN = "https://checkout.stripe.com";

/** Accepts only Stripe-hosted HTTPS Checkout destinations before navigation. */
export function getStripeCheckoutRedirectUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.origin !== STRIPE_CHECKOUT_ORIGIN ||
      url.username !== "" ||
      url.password !== ""
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
