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
import PhotoEditItemCard, {
  type PhotoEditItemData,
  emptyPhotoEditItem,
} from "@/components/order/photo-editing/PhotoEditItemCard";
import { redirectOnOrderAuthError } from "@/components/order/order-redirect";
import { calculatePhotoEditItemTotal } from "@/lib/pricing";
import { submitOrder } from "@/lib/submit-order";
import Container from "@/components/layout/Container";

// Authenticated dashboard order form. Client identity is sourced
// server-side from the session + client_profiles (see /api/order).

interface PhotoEditingOrderFormProps {
  clientEmail: string;
  orderRoute: string;
}

export default function PhotoEditingOrderForm({
  clientEmail,
  orderRoute,
}: PhotoEditingOrderFormProps) {
  const [items, setItems] = useState<PhotoEditItemData[]>([emptyPhotoEditItem()]);
  const [orderTerms, setOrderTerms] = useState<OrderTermsData>(emptyOrderTerms);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleItemChange = (index: number, data: PhotoEditItemData) => {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  };

  const handleAddItem = () => setItems((prev) => [...prev, emptyPhotoEditItem()]);

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApplyToAll = () => {
    if (items.length <= 1) return;
    const firstOptions = items[0].selectedOptions;
    setItems((prev) =>
      prev.map((item, i) =>
        i === 0 ? item : { ...item, selectedOptions: [...firstOptions] }
      )
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");

    const itemsMetadata = items.map((item) => ({
      selectedOptions: item.selectedOptions,
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
    setItems([emptyPhotoEditItem()]);
    setOrderTerms(emptyOrderTerms);
    setSubmitted(false);
    setOrderNumber("");
    setSubmitError("");
  };

  // --- Validation ---
  const allItemsValid = items.every(
    (item) => item.file !== null && item.selectedOptions.length > 0
  );
  const termsAccepted = orderTerms.accepted;
  const canSubmit = items.length > 0 && allItemsValid && termsAccepted;

  // --- Summary ---
  const summaryItems: SummaryItem[] = items.map((item, i) => ({
    label: `Photo #${i + 1}`,
    subtotal: calculatePhotoEditItemTotal(item.selectedOptions),
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
      title="Real Estate Photo Editing"
      subtitle="Select editing options for each photo. Price is based on your selections."
      sidebar={
        <OrderSummary
          serviceName="Photo Editing"
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

      <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p>
          Some item removal projects can be complex. Removing large objects may
          require recreating the hidden background area. If the image requires
          advanced reconstruction, we may confirm a custom quote before starting.
        </p>
      </div>

      <div className="space-y-5">
        {items.map((item, index) => (
          <PhotoEditItemCard
            key={index}
            index={index}
            data={item}
            onChange={(data) => handleItemChange(index, data)}
            onRemove={() => handleRemoveItem(index)}
            canRemove={items.length > 1}
            onApplyToAll={handleApplyToAll}
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
