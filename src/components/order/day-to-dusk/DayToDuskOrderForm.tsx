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
  DAY_TO_DUSK_SUB_SERVICE,
  DAY_TO_DUSK_OPTION_ID,
} from "@/lib/day-to-dusk";
import DayToDuskItemCard, {
  type DayToDuskItemData,
  emptyDayToDuskItem,
} from "./DayToDuskItemCard";

// ============================================================
// DayToDuskOrderForm — dedicated Day to Dusk order form.
//
// Backend model is UNCHANGED: serviceType "photo-editing", fixed
// option day-to-dusk-pe (500 cents/image), PE order numbering,
// sub_service = day-to-dusk. Identity is sourced server-side (no
// "Your Details" block). The client never sees the generic photo
// editing options checklist.
//
// Every dusk style and lighting preference is included in the base
// price and never changes the subtotal.
// ============================================================

interface DayToDuskOrderFormProps {
  clientEmail: string;
  orderRoute: string;
  /** mediaKey → resolved dusk-style example image (admin-managed). */
  duskStyleImages: Record<string, ServiceOptionImage>;
}

export default function DayToDuskOrderForm({
  clientEmail,
  orderRoute,
  duskStyleImages,
}: DayToDuskOrderFormProps) {
  const [items, setItems] = useState<DayToDuskItemData[]>([
    emptyDayToDuskItem(),
  ]);
  const [jobTitle, setJobTitle] = useState("");
  const [orderTerms, setOrderTerms] = useState<OrderTermsData>(emptyOrderTerms);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleItemChange = (index: number, data: DayToDuskItemData) => {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  };

  const handleAddItem = () =>
    setItems((prev) => [...prev, emptyDayToDuskItem()]);

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Copy ONLY the intended preferences from `sourceIndex` to every
  // other item: the dusk style, the three lighting preferences, and the
  // file-size preference. Uploaded files, Additional Instructions, and
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
              duskStyle: source.duskStyle,
              turnOnInteriorLights: source.turnOnInteriorLights,
              turnOnExteriorLights: source.turnOnExteriorLights,
              addPoolLights: source.addPoolLights,
              fileSizeLimit: source.fileSizeLimit,
            }
      );
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");

    // Each item carries the fixed single option + the day-to-dusk
    // sub-service + its dusk style and lighting preferences. The server
    // re-validates the option matches the sub-service, validates the
    // typed dusk-style enum + boolean lighting fields, and recalculates
    // the price from PHOTO_EDIT_OPTIONS.
    const itemsMetadata = items.map((item) => ({
      subService: DAY_TO_DUSK_SUB_SERVICE,
      selectedOptions: [DAY_TO_DUSK_OPTION_ID],
      fileSizeLimit: item.fileSizeLimit,
      disclaimerText: item.disclaimerText,
      additionalInfo: item.additionalInfo,
      duskStyle: item.duskStyle,
      turnOnInteriorLights: item.turnOnInteriorLights,
      turnOnExteriorLights: item.turnOnExteriorLights,
      addPoolLights: item.addPoolLights,
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
    setItems([emptyDayToDuskItem()]);
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
    items.length > 0 &&
    allItemsValid &&
    termsAccepted &&
    isJobTitleValid(jobTitle);

  // --- Summary ---
  const fixedSubtotal = calculatePhotoEditItemTotal([DAY_TO_DUSK_OPTION_ID]);
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
      title="Day to Dusk"
      subtitle="Transform daytime exterior photographs into warm, realistic twilight images with illuminated interiors and natural dusk skies."
      sidebar={
        <OrderSummary
          serviceName="Day to Dusk"
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
          <DayToDuskItemCard
            key={index}
            index={index}
            data={item}
            onChange={(data) => handleItemChange(index, data)}
            onRemove={() => handleRemoveItem(index)}
            canRemove={items.length > 1}
            duskStyleImages={duskStyleImages}
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
