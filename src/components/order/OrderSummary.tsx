"use client";

import Link from "next/link";
import { useDisplayCurrency } from "@/components/pricing/currency-client";
import { calculateOrderQuote } from "@/lib/pricing/calculate";
import { formatMoney } from "@/lib/pricing/format";
import type {
  OrderPricingPreviewInput,
  OrderQuote,
} from "@/lib/pricing/types";
import type { WelcomeOfferAvailability } from "@/lib/welcome-offer";
import {
  getOrderSubmitFooterCopy,
  getOrderSummarySupportingCopy,
} from "@/components/order/order-summary-copy";

export interface SummaryItem {
  label: string;
}

interface OrderSummaryProps {
  serviceName: string;
  items: SummaryItem[];
  pricingInput: OrderPricingPreviewInput;
  welcomeOfferAvailability?: WelcomeOfferAvailability;
  onSubmit: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  /** CTA label. Defaults to "Submit Order" so existing forms are unchanged. */
  submitLabel?: string;
  /** CTA label while submitting. Defaults to "Submitting...". */
  submittingLabel?: string;
  /** Compact guidance rendered directly below the submit action. */
  submitHelper?: React.ReactNode;
  /** Footer note under the CTA. Omit for quote-aware review copy; null hides it. */
  footerNote?: React.ReactNode;
}

export default function OrderSummary({
  serviceName,
  items,
  pricingInput,
  welcomeOfferAvailability,
  onSubmit,
  isSubmitting,
  canSubmit,
  submitLabel = "Submit Order",
  submittingLabel = "Submitting...",
  submitHelper,
  footerNote,
}: OrderSummaryProps) {
  const currency = useDisplayCurrency();
  let quote: OrderQuote | null = null;
  try {
    quote = calculateOrderQuote(
      { ...pricingInput, currency },
      { welcomeOfferAvailability },
    );
  } catch {
    // Incomplete form selections are expected while the client is editing.
    // The server remains strict and rejects invalid or unknown IDs.
  }
  const supportingCopy = quote ? getOrderSummarySupportingCopy(quote) : [];
  const resolvedFooterNote =
    footerNote === undefined && quote
      ? getOrderSubmitFooterCopy(quote)
      : footerNote;

  return (
    <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
      <h3 className="text-base font-semibold text-foreground mb-4">
        Order Summary
      </h3>

      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-4">
          <span className="text-muted">Service</span>
          <span className="min-w-0 break-words text-right font-medium text-foreground">
            {serviceName}
          </span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-4">
          <span className="text-muted">Items</span>
          <span className="min-w-0 text-right font-medium text-foreground">
            {items.length}
          </span>
        </div>

        {/* Per-item breakdown */}
        {items.length > 0 && (
          <div className="border-t border-border pt-3 space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between gap-4 text-xs">
                <span className="min-w-0 break-words text-muted">
                  {item.label}
                </span>
                <span className="text-foreground font-medium flex-shrink-0">
                  {formatMoney(
                    quote?.items[i]?.lineSubtotalCents ?? 0,
                    currency
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {quote ? (
          <div className="border-t border-border pt-3 mt-3 space-y-2">
            <div className="flex justify-between gap-4">
              <span className="text-muted">Base subtotal</span>
              <span className="font-medium text-foreground">
                {formatMoney(quote.baseSubtotalCents, currency)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted">Add-ons</span>
              <span className="font-medium text-foreground">
                {formatMoney(quote.addOnSubtotalCents, currency)}
              </span>
            </div>
            {quote.welcomeDiscountCents > 0 && (
              <div className="flex justify-between gap-4 text-green-700">
                <span>Welcome Offer</span>
                <span className="font-semibold">
                  −{formatMoney(quote.welcomeDiscountCents, currency)}
                </span>
              </div>
            )}
            {quote.volumeDiscountPercent > 0 && (
              <div className="flex justify-between gap-4 text-green-700">
                <span>Volume discount — {quote.volumeDiscountPercent}%</span>
                <span className="font-semibold">
                  −{formatMoney(quote.volumeDiscountCents, currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-border pt-3">
              <span className="font-semibold text-foreground">
                Estimated total
              </span>
              <span className="font-bold text-lg text-primary">
                {quote.customQuote || quote.totalCents === null
                  ? "Custom quote"
                  : formatMoney(quote.totalCents, currency)}
              </span>
            </div>
            {quote.totalCents === 0 && (
              <p className="font-semibold text-emerald-700">
                No payment required
              </p>
            )}
            {supportingCopy.map((line) => (
              <p key={line} className="text-[11px] text-muted">
                {line}
              </p>
            ))}
          </div>
        ) : (
          <div className="border-t border-border pt-3 mt-3 text-xs text-muted">
            Complete the service selections to calculate the estimate.
          </div>
        )}
      </div>

      {quote?.customQuote ? (
        <Link
          href="/contact"
          className="mt-6 block w-full rounded-lg bg-primary px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-light"
        >
          Request a custom quote
        </Link>
      ) : (
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || isSubmitting}
          className="mt-6 w-full bg-primary text-white py-3 px-4 rounded-lg font-semibold text-sm hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
      )}

      {submitHelper != null && (
        <div className="mt-3 text-xs leading-relaxed text-muted">
          {submitHelper}
        </div>
      )}

      {resolvedFooterNote != null && (
        <p className="text-xs text-muted text-center mt-3">
          {resolvedFooterNote}
        </p>
      )}
    </div>
  );
}
