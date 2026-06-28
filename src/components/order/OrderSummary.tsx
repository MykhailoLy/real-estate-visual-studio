"use client";

import Link from "next/link";
import { useDisplayCurrency } from "@/components/pricing/currency-client";
import { calculateOrderQuote } from "@/lib/pricing/calculate";
import { formatMoney } from "@/lib/pricing/format";
import type {
  OrderPricingPreviewInput,
  OrderQuote,
} from "@/lib/pricing/types";

export interface SummaryItem {
  label: string;
}

interface OrderSummaryProps {
  serviceName: string;
  items: SummaryItem[];
  pricingInput: OrderPricingPreviewInput;
  onSubmit: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  /** CTA label. Defaults to "Submit Order" so existing forms are unchanged. */
  submitLabel?: string;
  /** CTA label while submitting. Defaults to "Submitting...". */
  submittingLabel?: string;
  /** Compact guidance rendered directly below the submit action. */
  submitHelper?: React.ReactNode;
  /**
   * Footer note under the CTA. Defaults to the "No payment now" copy.
   * Pass null to hide it (e.g. on a Configure step that only advances
   * to Review).
   */
  footerNote?: React.ReactNode;
}

const DEFAULT_FOOTER_NOTE = "No payment now. We confirm & invoice after review.";

export default function OrderSummary({
  serviceName,
  items,
  pricingInput,
  onSubmit,
  isSubmitting,
  canSubmit,
  submitLabel = "Submit Order",
  submittingLabel = "Submitting...",
  submitHelper,
  footerNote = DEFAULT_FOOTER_NOTE,
}: OrderSummaryProps) {
  const currency = useDisplayCurrency();
  let quote: OrderQuote | null = null;
  try {
    quote = calculateOrderQuote({ ...pricingInput, currency });
  } catch {
    // Incomplete form selections are expected while the client is editing.
    // The server remains strict and rejects invalid or unknown IDs.
  }

  return (
    <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
      <h3 className="text-base font-semibold text-foreground mb-4">
        Order Summary
      </h3>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Service</span>
          <span className="font-medium text-foreground">{serviceName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Items</span>
          <span className="font-medium text-foreground">{items.length}</span>
        </div>

        {/* Per-item breakdown */}
        {items.length > 0 && (
          <div className="border-t border-border pt-3 space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted truncate mr-2">{item.label}</span>
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
              Estimated total before tax
            </span>
            <span className="font-bold text-lg text-primary">
              {quote.customQuote || quote.totalCents === null
                ? "Custom quote"
                : formatMoney(quote.totalCents, currency)}
            </span>
          </div>
          <p className="text-[11px] text-muted">
            Taxes calculated separately where applicable.
          </p>
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

      {footerNote != null && (
        <p className="text-xs text-muted text-center mt-3">{footerNote}</p>
      )}
    </div>
  );
}
