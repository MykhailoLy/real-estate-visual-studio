import type { OrderQuote } from "@/lib/pricing/types";

type OrderDisplayQuote = Pick<
  OrderQuote,
  "customQuote" | "totalCents" | "welcomeDiscountCents"
>;

export const ZERO_TOTAL_SUPPORTING_COPY =
  "This order is fully covered by your Welcome Offer. No payment is required.";
export const POSITIVE_WELCOME_OFFER_SUPPORTING_COPY =
  "Your Welcome Offer has been applied. Payment is required for the remaining balance.";
export const CHECKOUT_TAX_SUPPORTING_COPY =
  "Applicable tax is included and identified by Stripe at Checkout.";
export const ORDINARY_FIXED_PRICE_SUPPORTING_COPY =
  "For eligible fixed-price online orders, this is the Checkout total. Applicable tax is included and identified by Stripe.";
export const CUSTOM_QUOTE_SUPPORTING_COPY =
  "Final tax treatment will be confirmed in your written quote.";

export const ZERO_TOTAL_FOOTER_COPY =
  "No payment will be requested for this order.";
export const ORDINARY_FIXED_PRICE_FOOTER_COPY =
  "Payment is required after submitting the order.";

export function getOrderTotalSupportingCopy(
  quote: OrderDisplayQuote,
): readonly string[] {
  if (quote.customQuote || quote.totalCents === null) {
    return [CUSTOM_QUOTE_SUPPORTING_COPY];
  }
  if (quote.totalCents === 0) {
    return [ZERO_TOTAL_SUPPORTING_COPY];
  }
  if (quote.welcomeDiscountCents > 0) {
    return [
      POSITIVE_WELCOME_OFFER_SUPPORTING_COPY,
      CHECKOUT_TAX_SUPPORTING_COPY,
    ];
  }
  return [ORDINARY_FIXED_PRICE_SUPPORTING_COPY];
}

export function getOrderSubmitFooterCopy(
  quote: OrderDisplayQuote,
): string | null {
  if (quote.customQuote || quote.totalCents === null) return null;
  if (quote.totalCents === 0) return ZERO_TOTAL_FOOTER_COPY;
  if (quote.welcomeDiscountCents > 0) {
    return POSITIVE_WELCOME_OFFER_SUPPORTING_COPY;
  }
  return ORDINARY_FIXED_PRICE_FOOTER_COPY;
}

export function getOrderSummarySupportingCopy(
  quote: OrderDisplayQuote,
): readonly string[] {
  const supportingCopy = getOrderTotalSupportingCopy(quote);
  const footerCopy = getOrderSubmitFooterCopy(quote);

  return footerCopy === POSITIVE_WELCOME_OFFER_SUPPORTING_COPY
    ? supportingCopy.filter((line) => line !== footerCopy)
    : supportingCopy;
}
