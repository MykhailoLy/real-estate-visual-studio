"use client";

import { formatMoney } from "@/lib/pricing/format";
import type { OrderQuote } from "@/lib/pricing/types";
import { getOrderTotalSupportingCopy } from "@/components/order/order-summary-copy";

// ============================================================
// OrderReviewHeader — top-of-review summary block.
//
// Shows the order-level facts the client should confirm before
// submitting: Job Title, service, photo count and estimated total.
// Generic over service name + counts so it can be reused by other
// order flows that adopt the Review step later.
// ============================================================

interface OrderReviewHeaderProps {
  jobTitle: string;
  serviceName: string;
  photoCount: number;
  quote: OrderQuote;
  addOnLabel?: string;
}

export default function OrderReviewHeader({
  jobTitle,
  serviceName,
  photoCount,
  quote,
  addOnLabel = "Add-ons",
}: OrderReviewHeaderProps) {
  const supportingCopy = getOrderTotalSupportingCopy(quote);

  return (
    <div className="bg-white border border-border rounded-xl p-5 sm:p-6">
      <h2 className="text-xl font-bold text-foreground">Review Your Order</h2>
      <p className="mt-1 text-dashboard-body text-muted">
        Please confirm the details below before submitting.
      </p>

      <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div className="sm:col-span-2">
          <dt className="text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-muted-light">
            Job Title
          </dt>
          <dd className="mt-0.5 font-semibold text-foreground break-words">
            {jobTitle.trim() || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-muted-light">
            Service
          </dt>
          <dd className="mt-0.5 font-medium text-foreground">{serviceName}</dd>
        </div>
        <div>
          <dt className="text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-muted-light">
            Photos
          </dt>
          <dd className="mt-0.5 font-medium text-foreground">{photoCount}</dd>
        </div>
        <div className="sm:col-span-2 border-t border-border pt-3 grid grid-cols-2 gap-2">
          <dt className="text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-muted-light">
            Base subtotal
          </dt>
          <dd className="text-right font-medium text-foreground">
            {formatMoney(quote.baseSubtotalCents, quote.currency)}
          </dd>
          <dt className="text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-muted-light">
            {addOnLabel}
          </dt>
          <dd className="text-right font-medium text-foreground">
            {formatMoney(quote.addOnSubtotalCents, quote.currency)}
          </dd>
          {quote.welcomeDiscountCents > 0 && (
            <>
              <dt className="text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-green-700">
                Welcome Offer
              </dt>
              <dd className="text-right font-semibold text-green-700">
                −{formatMoney(quote.welcomeDiscountCents, quote.currency)}
              </dd>
            </>
          )}
          {quote.volumeDiscountPercent > 0 && (
            <>
              <dt className="text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-green-700">
                Volume discount — {quote.volumeDiscountPercent}%
              </dt>
              <dd className="text-right font-semibold text-green-700">
                −{formatMoney(quote.volumeDiscountCents, quote.currency)}
              </dd>
            </>
          )}
          <dt className="text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-muted-light">
            Estimated total
          </dt>
          <dd className="text-right text-lg font-bold text-primary">
            {quote.totalCents === null
              ? "Custom quote"
              : formatMoney(quote.totalCents, quote.currency)}
          </dd>
          {quote.totalCents === 0 && (
            <p className="col-span-2 font-semibold text-emerald-700">
              No payment required
            </p>
          )}
          {supportingCopy.map((line) => (
            <p key={line} className="col-span-2 text-dashboard-metadata text-muted">
              {line}
            </p>
          ))}
        </div>
      </dl>
    </div>
  );
}
