"use client";

import { usePartnerPricing } from "@/components/order/PartnerPricingContext";

import { ArrowLeft } from "lucide-react";
import OrderReviewHeader from "@/components/order/OrderReviewHeader";
import OrderReviewItem, {
  type ReviewFileDisplay,
} from "@/components/order/OrderReviewItem";
import OrderTermsBlock, {
  type OrderTermsData,
} from "@/components/order/OrderTermsBlock";
import { useDisplayCurrency } from "@/components/pricing/currency-client";
import { calculateOrderQuote } from "@/lib/pricing/calculate";
import { calculatePhotoEditItemTotal } from "@/lib/pricing";
import type { OrderDraftUploadedFileSummary } from "@/lib/order-drafts/files";
import { buildSingleExposureDraftFileSlotKey } from "@/lib/order-drafts/single-exposure";
import {
  SINGLE_EXPOSURE_OPTION_ID,
  getSingleExposureSelectedOptions,
} from "@/lib/image-enhancement";
import type { SingleExposureItemData } from "./SingleExposureItemCard";
import { buildSingleExposureReviewRows } from "./single-exposure-review";
import ReferenceFilesReview from "@/components/order/ReferenceFilesReview";
import { ORDER_REVIEW_BACK_LABEL } from "@/components/order/order-flow-copy";
import { mergeReferenceFiles } from "@/lib/reference-files";
import type { WelcomeOfferAvailability } from "@/lib/welcome-offer";

const SERVICE_NAME = "Image Enhancement — Single Exposure";

interface SingleExposureReviewProps {
  jobTitle: string;
  items: SingleExposureItemData[];
  uploadedFilesBySlot: Map<string, OrderDraftUploadedFileSummary>;
  orderTerms: OrderTermsData;
  onTermsChange: (data: OrderTermsData) => void;
  onEditItem: (index: number) => void;
  onBack: () => void;
  submitError: string;
  disabled?: boolean;
  welcomeOfferAvailability: WelcomeOfferAvailability;
}

function toReviewFileDisplay(
  file: OrderDraftUploadedFileSummary | undefined,
): ReviewFileDisplay | null {
  return file
    ? {
        filename: file.originalFilename,
        fileSize: file.fileSize,
        previewUrl: file.previewUrl ?? null,
      }
    : null;
}

export default function SingleExposureReview({
  jobTitle,
  items,
  uploadedFilesBySlot,
  orderTerms,
  onTermsChange,
  onEditItem,
  onBack,
  submitError,
  disabled = false,
  welcomeOfferAvailability,
}: SingleExposureReviewProps) {
  const currency = useDisplayCurrency();
  const { partnerClient } = usePartnerPricing();
  const pricingItems = items.map((item) => ({
    selectedOptions: getSingleExposureSelectedOptions(
      item.selectedAddons,
      item.aerialEditing,
    ),
    baseOptionId: SINGLE_EXPOSURE_OPTION_ID,
    dedicatedSubService: "image-enhancement-single-exposure",
  }));
  const quote = calculateOrderQuote(
    {
      serviceType: "photo-editing",
      currency,
      items: pricingItems,
    },
    { welcomeOfferAvailability, partnerClient },
  );

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-dashboard-action font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {ORDER_REVIEW_BACK_LABEL}
      </button>

      <OrderReviewHeader
        jobTitle={jobTitle}
        serviceName={SERVICE_NAME}
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
          const persistedOriginal = toReviewFileDisplay(
            uploadedFilesBySlot.get(
              buildSingleExposureDraftFileSlotKey(
                item.clientItemId,
                "original",
              ),
            ),
          );
          const persistedReference = toReviewFileDisplay(
            uploadedFilesBySlot.get(
              buildSingleExposureDraftFileSlotKey(
                item.clientItemId,
                "reference",
              ),
            ),
          );
          const selectedOptions = pricingItems[index]?.selectedOptions ?? [
            SINGLE_EXPOSURE_OPTION_ID,
          ];
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
          const subtotal =
            quote.items[index]?.lineSubtotalCents ??
            calculatePhotoEditItemTotal(
              selectedOptions,
              currency,
              SINGLE_EXPOSURE_OPTION_ID,
            );

          return (
            <div key={item.clientItemId} className="space-y-2">
              <OrderReviewItem
                index={index}
                file={item.file}
                persistedFile={item.file ? null : persistedOriginal}
                rows={buildSingleExposureReviewRows(
                  item,
                  currency,
                  reviewReferences.length > 0,
                )}
                subtotalCents={subtotal}
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

      <button
        type="button"
        onClick={onBack}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-dashboard-action font-semibold text-primary transition-colors hover:text-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {ORDER_REVIEW_BACK_LABEL}
      </button>
    </div>
  );
}
