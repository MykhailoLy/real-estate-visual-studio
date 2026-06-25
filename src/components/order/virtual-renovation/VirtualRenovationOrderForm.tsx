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
import OrderJobTitleField, {
  isJobTitleValid,
} from "@/components/order/OrderJobTitleField";
import RenovationItemCard, {
  type RenovationItemData,
  emptyRenovationItem,
} from "@/components/order/virtual-renovation/RenovationItemCard";
import { redirectOnOrderAuthError } from "@/components/order/order-redirect";
import { submitOrder } from "@/lib/submit-order";
import Container from "@/components/layout/Container";

// Authenticated dashboard order form. Client identity is sourced
// server-side from the session + client_profiles (see /api/order).

interface VirtualRenovationOrderFormProps {
  clientEmail: string;
  orderRoute: string;
}

export default function VirtualRenovationOrderForm({
  clientEmail,
  orderRoute,
}: VirtualRenovationOrderFormProps) {
  const [items, setItems] = useState<RenovationItemData[]>([emptyRenovationItem()]);
  const [jobTitle, setJobTitle] = useState("");
  const [orderTerms, setOrderTerms] = useState<OrderTermsData>(emptyOrderTerms);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleItemChange = (index: number, data: RenovationItemData) => {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  };

  const handleAddItem = () => setItems((prev) => [...prev, emptyRenovationItem()]);

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");

    const itemsMetadata = items.map((item) => ({
      selectedInternal: item.selectedInternal,
      selectedExternal: item.selectedExternal,
      room: item.room,
      presentationStyle: item.presentationStyle,
      fileSizeLimit: item.fileSizeLimit,
      disclaimerText: item.disclaimerText,
      referenceLink: item.referenceLink,
      additionalInfo: item.additionalInfo,
    }));

    const files = items.map((item) => ({
      file: item.file,
      referenceFile: item.referenceFile,
    }));

    const result = await submitOrder(
      "virtual-renovation",
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
    setItems([emptyRenovationItem()]);
    setJobTitle("");
    setOrderTerms(emptyOrderTerms);
    setSubmitted(false);
    setOrderNumber("");
    setSubmitError("");
  };

  // --- Validation ---
  const allItemsValid = items.every(
    (item) =>
      item.file !== null &&
      item.room !== "" &&
      (item.selectedInternal.length > 0 || item.selectedExternal.length > 0)
  );
  const termsAccepted = orderTerms.accepted;
  const canSubmit =
    items.length > 0 && allItemsValid && termsAccepted && isJobTitleValid(jobTitle);

  // --- Summary ---
  const summaryItems: SummaryItem[] = items.map((item, i) => ({
    label: item.room || `Image #${i + 1}`,
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
      title="Virtual Renovation"
      subtitle="Select renovation options for each image. Price is calculated based on your selections."
      sidebar={
        <OrderSummary
          serviceName="Virtual Renovation"
          items={summaryItems}
          pricingInput={{
            serviceType: "virtual-renovation",
            items: items.map((item) => ({
              selectedInternal: item.selectedInternal,
              selectedExternal: item.selectedExternal,
            })),
          }}
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

      <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p>
          Some renovation edits may require custom review if the image involves
          major reconstruction or unclear source material. We will confirm the
          final price before starting.
        </p>
      </div>

      <div className="space-y-5">
        {items.map((item, index) => (
          <RenovationItemCard
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
