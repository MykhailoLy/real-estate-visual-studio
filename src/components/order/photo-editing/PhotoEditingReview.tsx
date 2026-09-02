"use client";

import { ArrowLeft } from "lucide-react";
import OrderReviewHeader from "@/components/order/OrderReviewHeader";
import OrderReviewItem from "@/components/order/OrderReviewItem";
import OrderTermsBlock, {
  type OrderTermsData,
} from "@/components/order/OrderTermsBlock";
import { useDisplayCurrency } from "@/components/pricing/currency-client";
import type { OrderDraftUploadedFileSummary } from "@/lib/order-drafts/files";
import type { PhotoEditItemData } from "./PhotoEditItemCard";
import {
  buildPhotoEditingReviewRows,
  calculatePhotoEditingReviewQuote,
  findPhotoEditingReviewFileDisplay,
} from "./photo-editing-review";
import { ORDER_REVIEW_BACK_LABEL } from "@/components/order/order-flow-copy";

interface PhotoEditingReviewProps {
  jobTitle: string;
  items: PhotoEditItemData[];
  uploadedFiles: OrderDraftUploadedFileSummary[];
  orderTerms: OrderTermsData;
  onTermsChange: (data: OrderTermsData) => void;
  onEditItem: (clientItemId: string) => void;
  onBack: () => void;
  submitError: string;
  disabled?: boolean;
}

export default function PhotoEditingReview({
  jobTitle,
  items,
  uploadedFiles,
  orderTerms,
  onTermsChange,
  onEditItem,
  onBack,
  submitError,
  disabled = false,
}: PhotoEditingReviewProps) {
  const currency = useDisplayCurrency();
  const quote = calculatePhotoEditingReviewQuote(items, currency);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-dashboard-action font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {ORDER_REVIEW_BACK_LABEL}
      </button>

      <OrderReviewHeader
        jobTitle={jobTitle}
        serviceName="Photo Editing"
        photoCount={items.length}
        quote={quote}
      />

      {submitError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {submitError}
        </div>
      ) : null}

      <div className="space-y-5">
        {items.map((item, index) => {
          const pricedItem = quote.items[index];
          if (!pricedItem) return null;
          const persistedOriginal = findPhotoEditingReviewFileDisplay(
            item.clientItemId,
            uploadedFiles,
          );

          return (
            <OrderReviewItem
              key={item.clientItemId}
              index={index}
              file={item.file}
              persistedFile={item.file ? null : persistedOriginal}
              rows={buildPhotoEditingReviewRows(item)}
              subtotalCents={pricedItem.lineSubtotalCents}
              onEdit={() => onEditItem(item.clientItemId)}
              wrapFileNames
            />
          );
        })}
      </div>

      <OrderTermsBlock
        data={orderTerms}
        onChange={onTermsChange}
        disabled={disabled}
      />

      <button
        type="button"
        onClick={onBack}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-dashboard-action font-semibold text-primary transition-colors hover:text-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {ORDER_REVIEW_BACK_LABEL}
      </button>
    </div>
  );
}
