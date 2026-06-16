"use client";

import { useState } from "react";
import { Plus, Info } from "lucide-react";
import OrderLayout from "@/components/order/OrderLayout";
import OrderSummary, { type SummaryItem } from "@/components/order/OrderSummary";
import OrderTermsBlock, {
  type OrderTermsData,
  emptyOrderTerms,
} from "@/components/order/OrderTermsBlock";
import Confirmation from "@/components/order/Confirmation";
import DedicatedPhotoEditItemCard, {
  type DedicatedPhotoEditItemData,
  emptyDedicatedPhotoEditItem,
} from "@/components/order/photo-editing/DedicatedPhotoEditItemCard";
import { redirectOnOrderAuthError } from "@/components/order/order-redirect";
import { calculatePhotoEditItemTotal } from "@/lib/pricing";
import { submitOrder } from "@/lib/submit-order";
import Container from "@/components/layout/Container";
import {
  ITEM_REMOVAL_MIN_INSTRUCTIONS,
  type DedicatedPhotoEditingConfig,
} from "@/lib/dedicated-photo-editing";

// ============================================================
// DedicatedPhotoEditingOrderForm — shared form for the dedicated
// photo-editing services. The service is fixed by `config`; there is
// no editing-options checklist and no "apply to all" control.
//
// Each item submits exactly one fixed option (config.optionId) plus
// the sub-service slug, through the existing photo-editing backend.
// Identity is sourced server-side (no "Your Details" block).
// ============================================================

interface DedicatedPhotoEditingOrderFormProps {
  config: DedicatedPhotoEditingConfig;
  clientEmail: string;
  orderRoute: string;
}

export default function DedicatedPhotoEditingOrderForm({
  config,
  clientEmail,
  orderRoute,
}: DedicatedPhotoEditingOrderFormProps) {
  const [items, setItems] = useState<DedicatedPhotoEditItemData[]>([
    emptyDedicatedPhotoEditItem(),
  ]);
  const [orderTerms, setOrderTerms] = useState<OrderTermsData>(emptyOrderTerms);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleItemChange = (index: number, data: DedicatedPhotoEditItemData) => {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  };

  const handleAddItem = () =>
    setItems((prev) => [...prev, emptyDedicatedPhotoEditItem()]);

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");

    // Each item carries the fixed single option + the sub-service slug.
    // The server re-validates the option matches the sub-service and
    // recalculates the price from the existing PHOTO_EDIT_OPTIONS.
    const itemsMetadata = items.map((item) => ({
      subService: config.subService,
      selectedOptions: [config.optionId],
      fileSizeLimit: item.fileSizeLimit,
      disclaimerText: item.disclaimerText,
      additionalInfo: item.additionalInfo,
    }));

    const files = items.map((item) => ({
      file: item.file,
      referenceFile: null,
    }));

    const result = await submitOrder(
      "photo-editing",
      itemsMetadata,
      files,
      orderTerms
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
    setItems([emptyDedicatedPhotoEditItem()]);
    setOrderTerms(emptyOrderTerms);
    setSubmitted(false);
    setOrderNumber("");
    setSubmitError("");
  };

  // --- Validation ---
  const allItemsValid = items.every((item) => {
    if (item.file === null) return false;
    if (config.notesRequired) {
      return item.additionalInfo.trim().length >= ITEM_REMOVAL_MIN_INSTRUCTIONS;
    }
    return true;
  });
  const termsAccepted = orderTerms.accepted;
  const canSubmit = items.length > 0 && allItemsValid && termsAccepted;

  // --- Summary ---
  const fixedSubtotal = calculatePhotoEditItemTotal([config.optionId]);
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
            confirmationEmailSent={confirmationEmailSent}
            onNewOrder={handleNewOrder}
          />
        </Container>
      </section>
    );
  }

  return (
    <OrderLayout
      title={config.title}
      subtitle={config.subtitle}
      sidebar={
        <OrderSummary
          serviceName={config.summaryServiceName}
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

      {config.notice && (
        <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{config.notice}</p>
        </div>
      )}

      <div className="space-y-5">
        {items.map((item, index) => (
          <DedicatedPhotoEditItemCard
            key={index}
            index={index}
            config={config}
            data={item}
            onChange={(data) => handleItemChange(index, data)}
            onRemove={() => handleRemoveItem(index)}
            canRemove={items.length > 1}
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
