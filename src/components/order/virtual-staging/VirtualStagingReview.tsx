"use client";

import { ArrowLeft } from "lucide-react";
import OrderReviewHeader from "@/components/order/OrderReviewHeader";
import OrderReviewItem, {
  type ReviewFileDisplay,
} from "@/components/order/OrderReviewItem";
import OrderTermsBlock, {
  type OrderTermsData,
} from "@/components/order/OrderTermsBlock";
import { useDisplayCurrency } from "@/components/pricing/currency-client";
import {
  calculateStagingItemTotal,
} from "@/lib/pricing";
import { calculateOrderQuote } from "@/lib/pricing/calculate";
import type { OrderDraftUploadedFileSummary } from "@/lib/order-drafts/files";
import { buildVirtualStagingDraftFileSlotKey } from "@/lib/order-drafts/virtual-staging-files";
import type { StagingItemData } from "./StagingItemCard";
import { buildVirtualStagingReviewRows } from "./virtual-staging-review";
import ReferenceFilesReview from "@/components/order/ReferenceFilesReview";
import { mergeReferenceFiles } from "@/lib/reference-files";

// ============================================================
// VirtualStagingReview — read-only final step for Virtual Staging.
//
// This deliberately consumes the same item state, pricing calculator, draft
// file summaries, terms model, and OrderReview* primitives as the existing
// Day to Dusk flow. It does not save, upload, or submit anything; the one
// Submit Order action remains in the shared OrderSummary sidebar.
// ============================================================

const SERVICE_NAME = "Virtual Staging";

interface VirtualStagingReviewProps {
  jobTitle: string;
  items: StagingItemData[];
  uploadedFilesBySlot: Map<string, OrderDraftUploadedFileSummary>;
  orderTerms: OrderTermsData;
  onTermsChange: (data: OrderTermsData) => void;
  onEditItem: (index: number) => void;
  onBack: () => void;
  submitError: string;
  showTermsError?: boolean;
  termsErrorMessage?: string;
  termsContainerId?: string;
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

export default function VirtualStagingReview({
  jobTitle,
  items,
  uploadedFilesBySlot,
  orderTerms,
  onTermsChange,
  onEditItem,
  onBack,
  submitError,
  showTermsError = false,
  termsErrorMessage,
  termsContainerId,
  disabled = false,
}: VirtualStagingReviewProps) {
  const currency = useDisplayCurrency();
  const quote = calculateOrderQuote({
    serviceType: "virtual-staging",
    currency,
    items: items.map((item) => ({ selectedAddons: item.selectedAddons })),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
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

      {submitError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {submitError}
        </div>
      )}

      <div className="space-y-5">
        {items.map((item, index) => {
          const persistedOriginal = toReviewFileDisplay(
            uploadedFilesBySlot.get(
              buildVirtualStagingDraftFileSlotKey(
                item.clientItemId,
                "original",
              ),
            ),
          );
          const persistedReference = toReviewFileDisplay(
            uploadedFilesBySlot.get(
              buildVirtualStagingDraftFileSlotKey(
                item.clientItemId,
                "reference",
              ),
            ),
          );
          const subtotalCents =
            quote.items[index]?.lineSubtotalCents ??
            calculateStagingItemTotal(item.selectedAddons, currency);

          const reviewReferences = mergeReferenceFiles(
            item.referenceFiles,
            persistedReference
              ? [{
                  id: persistedReference.filename,
                  file: null,
                  filename: persistedReference.filename,
                  fileSize: persistedReference.fileSize,
                  mimeType: "image/jpeg",
                  lastModified: null,
                  previewUrl: persistedReference.previewUrl,
                }]
              : [],
          );
          return (
            <div key={item.clientItemId} className="space-y-2">
              <OrderReviewItem
                index={index}
                file={item.file}
                persistedFile={item.file ? null : persistedOriginal}
                rows={buildVirtualStagingReviewRows(item, currency)}
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
        showError={showTermsError}
        errorMessage={termsErrorMessage}
        containerId={termsContainerId}
        disabled={disabled}
      />

      <div className="flex">
        <button
          type="button"
          onClick={onBack}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary transition-colors hover:text-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Edit
        </button>
      </div>
    </div>
  );
}
