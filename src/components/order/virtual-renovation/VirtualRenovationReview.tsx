"use client";

import { ArrowLeft } from "lucide-react";
import OrderReviewHeader from "@/components/order/OrderReviewHeader";
import OrderReviewItem, {
  type ReviewFileDisplay,
} from "@/components/order/OrderReviewItem";
import ReferenceFilesReview from "@/components/order/ReferenceFilesReview";
import OrderTermsBlock, {
  type OrderTermsData,
} from "@/components/order/OrderTermsBlock";
import { useDisplayCurrency } from "@/components/pricing/currency-client";
import { calculateRenovationItemTotal } from "@/lib/pricing";
import { calculateOrderQuote } from "@/lib/pricing/calculate";
import type { OrderDraftUploadedFileSummary } from "@/lib/order-drafts/files";
import { mergeReferenceFiles } from "@/lib/reference-files";
import type { RenovationItemData } from "./RenovationItemCard";
import { buildVirtualRenovationReviewRows } from "./virtual-renovation-review";
import { ORDER_REVIEW_BACK_LABEL } from "@/components/order/order-flow-copy";

interface VirtualRenovationReviewProps {
  jobTitle: string;
  items: RenovationItemData[];
  uploadedFilesBySlot: Map<string, OrderDraftUploadedFileSummary>;
  orderTerms: OrderTermsData;
  onTermsChange: (data: OrderTermsData) => void;
  onEditItem: (index: number) => void;
  onBack: () => void;
  submitError: string;
  disabled?: boolean;
}

function toReviewFileDisplay(
  file: OrderDraftUploadedFileSummary | undefined,
): ReviewFileDisplay | null {
  if (!file) return null;
  return {
    filename: file.originalFilename,
    fileSize: file.fileSize,
    previewUrl: file.previewUrl ?? null,
  };
}

export default function VirtualRenovationReview({
  jobTitle,
  items,
  uploadedFilesBySlot,
  orderTerms,
  onTermsChange,
  onEditItem,
  onBack,
  submitError,
  disabled = false,
}: VirtualRenovationReviewProps) {
  const currency = useDisplayCurrency();
  const quote = calculateOrderQuote({
    serviceType: "virtual-renovation",
    currency,
    items: items.map((item) => ({
      selectedInternal: item.selectedInternal,
      selectedExternal: item.selectedExternal,
    })),
  });

  return (
    <div className="space-y-5">
      <div className="flex">
        <button
          type="button"
          onClick={onBack}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {ORDER_REVIEW_BACK_LABEL}
        </button>
      </div>

      <OrderReviewHeader
        jobTitle={jobTitle}
        serviceName="Virtual Renovation"
        photoCount={items.length}
        quote={quote}
        addOnLabel="Renovation selections"
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
          const persistedOriginal = toReviewFileDisplay(
            uploadedFilesBySlot.get(`${item.clientItemId}:original`),
          );
          const uploadedReference = uploadedFilesBySlot.get(
            `${item.clientItemId}:reference`,
          );
          const persistedReference = toReviewFileDisplay(uploadedReference);
          const subtotalCents =
            quote.items[index]?.lineSubtotalCents ??
            calculateRenovationItemTotal(
              item.selectedInternal,
              item.selectedExternal,
              currency,
            );
          const reviewReferences = mergeReferenceFiles(
            item.referenceFiles,
            persistedReference
              ? [
                  {
                    id: uploadedReference?.id ?? persistedReference.filename,
                    file: null,
                    filename: persistedReference.filename,
                    fileSize: persistedReference.fileSize,
                    mimeType: uploadedReference?.mimeType ?? "image/jpeg",
                    lastModified: null,
                    previewUrl: persistedReference.previewUrl,
                  },
                ]
              : [],
          );

          return (
            <div key={item.clientItemId} className="space-y-2">
              <OrderReviewItem
                index={index}
                file={item.file}
                persistedFile={item.file ? null : persistedOriginal}
                rows={buildVirtualRenovationReviewRows(item, currency)}
                subtotalCents={subtotalCents}
                onEdit={() => onEditItem(index)}
                wrapFileNames
              />
              <ReferenceFilesReview
                referenceLink={item.referenceLink}
                files={reviewReferences}
              />
            </div>
          );
        })}
      </div>

      <OrderTermsBlock
        data={orderTerms}
        onChange={onTermsChange}
        disabled={disabled}
      />

      <div className="flex">
        <button
          type="button"
          onClick={onBack}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary transition-colors hover:text-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {ORDER_REVIEW_BACK_LABEL}
        </button>
      </div>
    </div>
  );
}
