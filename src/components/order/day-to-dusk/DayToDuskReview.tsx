"use client";

import { usePartnerPricing } from "@/components/order/PartnerPricingContext";

import { ArrowLeft } from "lucide-react";
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
import { DAY_TO_DUSK_OPTION_ID, getDuskStyleLabel } from "@/lib/day-to-dusk";
import type { DayToDuskItemData } from "./DayToDuskItemCard";
import ReferenceFilesReview from "@/components/order/ReferenceFilesReview";
import type { WelcomeOfferAvailability } from "@/lib/welcome-offer";
import { ORDER_REVIEW_BACK_LABEL } from "@/components/order/order-flow-copy";

// ============================================================
// DayToDuskReview — Review & Confirm step body for a Day to Dusk order.
//
// Composes the reusable OrderReviewHeader + OrderReviewItem cards, the
// existing OrderTermsBlock (terms + portfolio permission), and the
// Back-to-Edit controls. It does NOT submit — the final Submit Order
// button lives in the shared OrderSummary sidebar so totals are not
// duplicated. All totals here are client estimates; the API still
// recalculates from the fixed day-to-dusk-pe option.
// ============================================================

const SERVICE_NAME = "Day to Dusk";

interface DayToDuskReviewProps {
  jobTitle: string;
  items: DayToDuskItemData[];
  orderTerms: OrderTermsData;
  onTermsChange: (data: OrderTermsData) => void;
  onEditItem: (index: number) => void;
  onBack: () => void;
  submitError: string;
  welcomeOfferAvailability: WelcomeOfferAvailability;
}

function fileSizeLabel(value: string): string {
  return value.trim() ? value : "Not specified";
}

function buildRows(item: DayToDuskItemData): ReviewRow[] {
  return [
    { label: "Dusk style", value: getDuskStyleLabel(item.duskStyle) },
    { label: "Interior lights", value: item.turnOnInteriorLights ? "Yes" : "No" },
    { label: "Exterior lights", value: item.turnOnExteriorLights ? "Yes" : "No" },
    { label: "Pool lights", value: item.addPoolLights ? "Yes" : "No" },
    { label: "File-size preference", value: fileSizeLabel(item.fileSizeLimit) },
    {
      label: "Additional Instructions",
      value: item.additionalInfo.trim() ? item.additionalInfo.trim() : "None",
    },
  ];
}

export default function DayToDuskReview({
  jobTitle,
  items,
  orderTerms,
  onTermsChange,
  onEditItem,
  onBack,
  submitError,
  welcomeOfferAvailability,
}: DayToDuskReviewProps) {
  const currency = useDisplayCurrency();
  const { partnerClient } = usePartnerPricing();
  const quote = calculateOrderQuote(
    {
      serviceType: "photo-editing",
      currency,
      items: items.map(() => ({
        selectedOptions: [DAY_TO_DUSK_OPTION_ID],
        baseOptionId: DAY_TO_DUSK_OPTION_ID,
        dedicatedSubService: "day-to-dusk",
      })),
    },
    { welcomeOfferAvailability, partnerClient },
  );
  const perItem = calculatePhotoEditItemTotal(
    [DAY_TO_DUSK_OPTION_ID],
    currency
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-dashboard-action font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {ORDER_REVIEW_BACK_LABEL}
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
          className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800"
        >
          {submitError}
        </div>
      )}

      <div className="space-y-5">
        {items.map((item, index) => (
          <div key={index} className="space-y-2">
            <OrderReviewItem
              index={index}
              file={item.file}
              rows={buildRows(item)}
              subtotalCents={perItem}
              onEdit={() => onEditItem(index)}
            />
            <ReferenceFilesReview
              referenceLink={item.referenceLink}
              files={item.referenceFiles}
            />
          </div>
        ))}
      </div>

      {/* Final confirmation — terms required before the order is sent. */}
      <OrderTermsBlock data={orderTerms} onChange={onTermsChange} />

      <div className="flex">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-dashboard-action font-semibold text-primary hover:text-primary-light transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {ORDER_REVIEW_BACK_LABEL}
        </button>
      </div>
    </div>
  );
}
