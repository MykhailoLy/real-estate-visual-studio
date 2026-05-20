"use client";

import { formatCurrency } from "@/lib/utils";
import { PRICING } from "@/lib/pricing";
import type { RemoteServiceType } from "@/types";

interface OrderSummaryProps {
  serviceType: RemoteServiceType | null;
  itemCount: number;
  onSubmit: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
}

export default function OrderSummary({
  serviceType,
  itemCount,
  onSubmit,
  isSubmitting,
  canSubmit,
}: OrderSummaryProps) {
  const pricing = serviceType ? PRICING[serviceType] : null;
  const estimatedTotal = pricing ? pricing.pricePerItem * itemCount : 0;

  const serviceNames: Record<RemoteServiceType, string> = {
    "virtual-staging": "Virtual Staging",
    "virtual-renovation": "Virtual Renovation",
    "floor-plans": "3D Floor Plans",
    "photo-editing": "Photo Editing",
  };

  return (
    <div className="bg-white border border-border rounded-xl p-6 shadow-sm">
      <h3 className="text-base font-semibold text-foreground mb-4">
        Order Summary
      </h3>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Service</span>
          <span className="font-medium text-foreground">
            {serviceType ? serviceNames[serviceType] : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Items</span>
          <span className="font-medium text-foreground">{itemCount}</span>
        </div>
        {pricing && (
          <div className="flex justify-between">
            <span className="text-muted">Price {pricing.unit}</span>
            <span className="font-medium text-foreground">
              {formatCurrency(pricing.pricePerItem)}
            </span>
          </div>
        )}
        <div className="border-t border-border pt-3 mt-3">
          <div className="flex justify-between">
            <span className="font-semibold text-foreground">Estimated Total</span>
            <span className="font-bold text-lg text-primary">
              {formatCurrency(estimatedTotal)}
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
