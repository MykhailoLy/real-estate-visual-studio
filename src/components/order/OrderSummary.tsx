"use client";

import { formatUSD } from "@/lib/utils";

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
}

export default function OrderSummary({
  serviceName,
  items,
  onSubmit,
  isSubmitting,
  canSubmit,
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
                  {formatUSD(item.subtotal)}
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
              {formatUSD(orderTotal)}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit || isSubmitting}
        className="mt-6 w-full bg-primary text-white py-3 px-4 rounded-lg font-semibold text-sm hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Submitting..." : "Submit Order"}
      </button>

      <p className="text-xs text-muted text-center mt-3">
        No payment now. We confirm &amp; invoice after review.
      </p>
    </div>
  );
}
