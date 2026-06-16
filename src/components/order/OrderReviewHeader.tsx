"use client";

import { RegionalCentsText } from "@/components/pricing/currency-client";

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
  estimatedTotalCents: number;
}

export default function OrderReviewHeader({
  jobTitle,
  serviceName,
  photoCount,
  estimatedTotalCents,
}: OrderReviewHeaderProps) {
  return (
    <div className="bg-white border border-border rounded-xl p-5 sm:p-6">
      <h2 className="text-xl font-bold text-foreground">Review Your Order</h2>
      <p className="text-sm text-muted mt-1">
        Please confirm the details below before submitting.
      </p>

      <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div className="sm:col-span-2">
          <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-light">
            Job Title
          </dt>
          <dd className="mt-0.5 font-semibold text-foreground break-words">
            {jobTitle.trim() || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-light">
            Service
          </dt>
          <dd className="mt-0.5 font-medium text-foreground">{serviceName}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-light">
            Photos
          </dt>
          <dd className="mt-0.5 font-medium text-foreground">{photoCount}</dd>
        </div>
        <div className="sm:col-span-2 border-t border-border pt-3">
          <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-light">
            Estimated total
          </dt>
          <dd className="mt-0.5 text-lg font-bold text-primary">
            <RegionalCentsText cents={estimatedTotalCents} />
          </dd>
        </div>
      </dl>
    </div>
  );
}
