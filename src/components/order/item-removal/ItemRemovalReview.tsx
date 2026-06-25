"use client";

import { ArrowLeft, Info } from "lucide-react";
import OrderReviewHeader from "@/components/order/OrderReviewHeader";
import OrderReviewItem, {
  type ReviewRow,
} from "@/components/order/OrderReviewItem";
import OrderTermsBlock, {
  type OrderTermsData,
} from "@/components/order/OrderTermsBlock";
import { calculatePhotoEditItemTotal } from "@/lib/pricing";
import { calculateOrderQuote } from "@/lib/pricing/calculate";
import { useDisplayCurrency } from "@/components/pricing/currency-client";
import {
  ITEM_REMOVAL_OPTION_ID,
  ITEM_REMOVAL_COMPLEXITY_NOTICE,
  getRemovalTaskLabels,
} from "@/lib/item-removal";
import type { ItemRemovalItemData } from "./ItemRemovalItemCard";

// ============================================================
// ItemRemovalReview — Review & Submit step body for an Item Removal
// & Virtual Cleaning order.
//
// Composes the reusable OrderReviewHeader + OrderReviewItem cards (the
// markup / reference preview is shown via OrderReviewItem's secondary
// slot), the existing OrderTermsBlock, a brief complexity notice, and
// the Back-to-Edit controls. It does NOT submit — the final Submit Order
// button lives in the shared OrderSummary sidebar so totals are not
// duplicated. All totals here are client estimates; the API recalculates
// from the fixed item-removal-cleaning-pe option.
// ============================================================

const SERVICE_NAME = "Item Removal & Virtual Cleaning";

interface ItemRemovalReviewProps {
  jobTitle: string;
  items: ItemRemovalItemData[];
  orderTerms: OrderTermsData;
  onTermsChange: (data: OrderTermsData) => void;
  onEditItem: (index: number) => void;
  onBack: () => void;
  submitError: string;
}

function fileSizeLabel(value: string): string {
  return value.trim() ? value : "Not specified";
}

function buildRows(item: ItemRemovalItemData): ReviewRow[] {
  const taskLabels = getRemovalTaskLabels(item.removalTasks);
  return [
    {
      label: "Work requested",
      value: taskLabels.length ? taskLabels.join(", ") : "None selected",
    },
    {
      label: "Instructions",
      value: item.additionalInfo.trim() ? item.additionalInfo.trim() : "—",
    },
    { label: "File-size preference", value: fileSizeLabel(item.fileSizeLimit) },
    {
      label: "Markup/reference",
      value: item.referenceFile ? "Included" : "None",
    },
  ];
}

export default function ItemRemovalReview({
  jobTitle,
  items,
  orderTerms,
  onTermsChange,
  onEditItem,
  onBack,
  submitError,
}: ItemRemovalReviewProps) {
  const currency = useDisplayCurrency();
  const quote = calculateOrderQuote({
    serviceType: "photo-editing",
    currency,
    items: items.map(() => ({
      selectedOptions: [ITEM_REMOVAL_OPTION_ID],
    })),
  });
  const perItem = calculatePhotoEditItemTotal(
    [ITEM_REMOVAL_OPTION_ID],
    currency
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Edit
        </button>
      </div>

      <OrderReviewHeader
        jobTitle={jobTitle}
        serviceName={SERVICE_NAME}
        photoCount={items.length}
        quote={quote}
      />

      {/* Brief complexity reminder on Review. */}
      <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
        <p>{ITEM_REMOVAL_COMPLEXITY_NOTICE}</p>
      </div>

      {submitError && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800"
        >
          {submitError}
        </div>
      )}

      <div className="space-y-5">
        {items.map((item, index) => (
          <OrderReviewItem
            key={index}
            index={index}
            file={item.file}
            secondaryFile={item.referenceFile}
            secondaryLabel="Markup / reference"
            rows={buildRows(item)}
            subtotalCents={perItem}
            onEdit={() => onEditItem(index)}
          />
        ))}
      </div>

      {/* Final confirmation — terms required before the order is sent. */}
      <OrderTermsBlock data={orderTerms} onChange={onTermsChange} />

      <div className="flex">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:text-primary-light transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Edit
        </button>
      </div>
    </div>
  );
}
