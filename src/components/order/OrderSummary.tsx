"use client";

import { RegionalCentsText } from "@/components/pricing/currency-client";

export interface SummaryItem {
  label: string;
  subtotal: number; // cents
}

interface OrderSummaryProps {
  serviceName: string;
  items: SummaryItem[];
  onSubmit: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  /** CTA label. Defaults to "Submit Order" so existing forms are unchanged. */
  submitLabel?: string;
  /** CTA label while submitting. Defaults to "Submitting...". */
  submittingLabel?: string;
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
  onSubmit,
  isSubmitting,
  canSubmit,
  submitLabel = "Submit Order",
  submittingLabel = "Submitting...",
  footerNote = DEFAULT_FOOTER_NOTE,
}: OrderSummaryProps) {
  const orderTotal = items.reduce((sum, item) => sum + item.subtotal, 0);

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
                  <RegionalCentsText cents={item.subtotal} />
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <div className="border-t border-border pt-3 mt-3">
          <div className="flex justify-between">
            <span className="font-semibold text-foreground">
              Estimated Total
            </span>
            <span className="font-bold text-lg text-primary">
              <RegionalCentsText cents={orderTotal} />
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Prices shown for selected region.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit || isSubmitting}
        className="mt-6 w-full bg-primary text-white py-3 px-4 rounded-lg font-semibold text-sm hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </button>

      {footerNote != null && (
        <p className="text-xs text-muted text-center mt-3">{footerNote}</p>
      )}
    </div>
  );
}
