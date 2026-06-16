"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import OrderLayout from "@/components/order/OrderLayout";
import OrderSummary, { type SummaryItem } from "@/components/order/OrderSummary";
import OrderTermsBlock, {
  type OrderTermsData,
  emptyOrderTerms,
} from "@/components/order/OrderTermsBlock";
import Confirmation from "@/components/order/Confirmation";
import OrderJobTitleField, {
  isJobTitleValid,
} from "@/components/order/OrderJobTitleField";
import { redirectOnOrderAuthError } from "@/components/order/order-redirect";
import { calculatePhotoEditItemTotal } from "@/lib/pricing";
import { submitOrder } from "@/lib/submit-order";
import Container from "@/components/layout/Container";
import type { ServiceOptionImage } from "@/lib/site-media";
import {
  SINGLE_EXPOSURE_SUB_SERVICE,
  SINGLE_EXPOSURE_OPTION_ID,
} from "@/lib/image-enhancement";
import SingleExposureItemCard, {
  type SingleExposureItemData,
  emptySingleExposureItem,
} from "./SingleExposureItemCard";

// ============================================================
// SingleExposureOrderForm — Image Enhancement — Single Exposure.
//
// Backend model is UNCHANGED: serviceType "photo-editing", fixed
// option image-enhancement-re (200 cents/image), PE order numbering.
// New orders pin sub_service = image-enhancement-single-exposure.
// Identity is sourced server-side (no "Your Details" block).
// ============================================================

interface SingleExposureOrderFormProps {
  clientEmail: string;
  orderRoute: string;
  /** mediaKey → resolved day-sky example image (admin-managed). */
  daySkyImages: Record<string, ServiceOptionImage>;
}

export default function SingleExposureOrderForm({
  clientEmail,
  orderRoute,
  daySkyImages,
}: SingleExposureOrderFormProps) {
  const [items, setItems] = useState<SingleExposureItemData[]>([
    emptySingleExposureItem(),
  ]);
  const [jobTitle, setJobTitle] = useState("");
  const [orderTerms, setOrderTerms] = useState<OrderTermsData>(emptyOrderTerms);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleItemChange = (index: number, data: SingleExposureItemData) => {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  };

  const handleAddItem = () =>
    setItems((prev) => [...prev, emptySingleExposureItem()]);

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Copy ONLY the intended preferences from `sourceIndex` to every other
  // item: the four three-state preferences, the day sky style, and the
  // file size preference. Uploaded files, Additional Instructions, and
  // the per-item disclaimer text are intentionally NOT copied.
  const handleApplyToAll = (sourceIndex: number) => {
    setItems((prev) => {
      const source = prev[sourceIndex];
      if (!source) return prev;
      return prev.map((item, i) =>
        i === sourceIndex
          ? item
          : {
              ...item,
              grassRepair: source.grassRepair,
              skyReplacement: source.skyReplacement,
              tvScreenReplacement: source.tvScreenReplacement,
              addFireToFireplace: source.addFireToFireplace,
              daySkyStyle: source.daySkyStyle,
              fileSizeLimit: source.fileSizeLimit,
            }
      );
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");

    // Each item carries the fixed single option + the single-exposure
    // sub-service + its preferences. The server re-validates the option
    // matches the sub-service, validates the typed preference enums, and
    // recalculates the price from PHOTO_EDIT_OPTIONS.
    const itemsMetadata = items.map((item) => ({
      subService: SINGLE_EXPOSURE_SUB_SERVICE,
      selectedOptions: [SINGLE_EXPOSURE_OPTION_ID],
      fileSizeLimit: item.fileSizeLimit,
      disclaimerText: item.disclaimerText,
      additionalInfo: item.additionalInfo,
      grassRepair: item.grassRepair,
      skyReplacement: item.skyReplacement,
      tvScreenReplacement: item.tvScreenReplacement,
      addFireToFireplace: item.addFireToFireplace,
      daySkyStyle: item.daySkyStyle,
    }));

    const files = items.map((item) => ({
      file: item.file,
      referenceFile: null,
    }));

    const result = await submitOrder(
      "photo-editing",
      itemsMetadata,
      files,
      orderTerms,
      jobTitle
    );

    if (result.success && result.orderNumber) {
      setOrderNumber(result.orderNumber);
      setConfirmationEmailSent(result.confirmationEmailSent === true);
      setSubmitted(true);
      setIsSubmitting(false);
      return;
    }

    if (redirectOnOrderAuthError(result, orderRoute)) return;

    setIsSubmitting(false);
    setSubmitError(result.error || "Submission failed. Please try again.");
  };

  const handleNewOrder = () => {
    setItems([emptySingleExposureItem()]);
    setJobTitle("");
    setOrderTerms(emptyOrderTerms);
    setSubmitted(false);
    setOrderNumber("");
    setSubmitError("");
  };

  // --- Validation ---
  const allItemsValid = items.every((item) => item.file !== null);
  const termsAccepted = orderTerms.accepted;
  const canSubmit =
    items.length > 0 && allItemsValid && termsAccepted && isJobTitleValid(jobTitle);

  // --- Summary ---
  const fixedSubtotal = calculatePhotoEditItemTotal([SINGLE_EXPOSURE_OPTION_ID]);
  const summaryItems: SummaryItem[] = items.map((_, i) => ({
    label: `Photo #${i + 1}`,
    subtotal: fixedSubtotal,
  }));

  if (submitted) {
    return (
      <section className="py-16 bg-surface min-h-screen">
        <Container>
          <Confirmation
            orderNumber={orderNumber}
            email={clientEmail}
            jobTitle={jobTitle}
            confirmationEmailSent={confirmationEmailSent}
            onNewOrder={handleNewOrder}
          />
        </Container>
      </section>
    );
  }

  return (
    <OrderLayout
      title="Image Enhancement — Single Exposure"
      subtitle="Professional colour, exposure, white balance, contrast and detail correction for standard real-estate photographs."
      sidebar={
        <OrderSummary
          serviceName="Image Enhancement — Single Exposure"
          items={summaryItems}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          canSubmit={canSubmit}
        />
      }
    >
      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          {submitError}
        </div>
      )}

      <OrderJobTitleField value={jobTitle} onChange={setJobTitle} />

      <div className="space-y-5">
        {items.map((item, index) => (
          <SingleExposureItemCard
            key={index}
            index={index}
            data={item}
            onChange={(data) => handleItemChange(index, data)}
            onRemove={() => handleRemoveItem(index)}
            canRemove={items.length > 1}
            daySkyImages={daySkyImages}
            onApplyToAll={() => handleApplyToAll(index)}
            showApplyToAll={items.length > 1}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddItem}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted hover:text-primary hover:border-primary/40 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Another Photo
      </button>

      <OrderTermsBlock data={orderTerms} onChange={setOrderTerms} />
    </OrderLayout>
  );
}
