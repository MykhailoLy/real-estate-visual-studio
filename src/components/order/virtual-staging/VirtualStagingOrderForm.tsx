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
import StagingItemCard, {
  type StagingItemData,
  emptyStagingItem,
} from "@/components/order/virtual-staging/StagingItemCard";
import { redirectOnOrderAuthError } from "@/components/order/order-redirect";
import { RegionalCentsText } from "@/components/pricing/currency-client";
import { calculateStagingItemTotal } from "@/lib/pricing";
import { submitOrder } from "@/lib/submit-order";
import Container from "@/components/layout/Container";
import { STAGING_BASE_PRICE } from "@/data/order-options";

// ============================================================
// Virtual Staging order form (authenticated dashboard).
//
// Identity (name/email/phone/company) is NOT collected here — it
// comes from the verified Supabase session + client_profiles on the
// server. `clientEmail` is used only for the confirmation screen;
// `orderRoute` is where we send the client back to after login /
// profile completion if the session/profile is not ready.
// ============================================================

interface VirtualStagingOrderFormProps {
  clientEmail: string;
  orderRoute: string;
}

export default function VirtualStagingOrderForm({
  clientEmail,
  orderRoute,
}: VirtualStagingOrderFormProps) {
  const [items, setItems] = useState<StagingItemData[]>([emptyStagingItem()]);
  const [orderTerms, setOrderTerms] = useState<OrderTermsData>(emptyOrderTerms);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleItemChange = (index: number, data: StagingItemData) => {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  };

  const handleAddItem = () => setItems((prev) => [...prev, emptyStagingItem()]);

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");

    const itemsMetadata = items.map((item) => ({
      roomName: item.roomName,
      furnitureStyle: item.furnitureStyle,
      fileSizeLimit: item.fileSizeLimit,
      disclaimerText: item.disclaimerText,
      referenceLink: item.referenceLink,
      additionalInfo: item.additionalInfo,
      selectedAddons: item.selectedAddons,
    }));

    const files = items.map((item) => ({
      file: item.file,
      referenceFile: item.referenceFile,
    }));

    const result = await submitOrder(
      "virtual-staging",
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

    // Auth/profile errors navigate away (preserving this order route).
    if (redirectOnOrderAuthError(result, orderRoute)) return;

    setIsSubmitting(false);
    setSubmitError(result.error || "Submission failed. Please try again.");
  };

  const handleNewOrder = () => {
    setItems([emptyStagingItem()]);
    setOrderTerms(emptyOrderTerms);
    setSubmitted(false);
    setOrderNumber("");
    setSubmitError("");
  };

  // --- Validation ---
  const allItemsValid = items.every(
    (item) => item.file !== null && item.roomName !== "" && item.furnitureStyle !== ""
  );
  const termsAccepted = orderTerms.accepted;
  const canSubmit = items.length > 0 && allItemsValid && termsAccepted;

  // --- Summary ---
  const summaryItems: SummaryItem[] = items.map((item, i) => ({
    label: item.roomName || `Image #${i + 1}`,
    subtotal: calculateStagingItemTotal(item.selectedAddons),
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
      title="Virtual Staging"
      subtitle={
        <>
          Upload your empty room photos and choose a furniture style.{" "}
          <RegionalCentsText cents={STAGING_BASE_PRICE} /> per image + optional
          add-ons.
        </>
      }
      sidebar={
        <OrderSummary
          serviceName="Virtual Staging"
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

      <div className="space-y-5">
        {items.map((item, index) => (
          <StagingItemCard
            key={index}
            index={index}
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
        Add Another Image
      </button>

      <OrderTermsBlock data={orderTerms} onChange={setOrderTerms} />
    </OrderLayout>
  );
}
