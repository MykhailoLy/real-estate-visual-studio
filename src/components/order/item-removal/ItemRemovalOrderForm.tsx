"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Info } from "lucide-react";
import OrderLayout from "@/components/order/OrderLayout";
import OrderSummary, { type SummaryItem } from "@/components/order/OrderSummary";
import OrderStepIndicator, {
  type OrderStep,
} from "@/components/order/OrderStepIndicator";
import {
  type OrderTermsData,
  emptyOrderTerms,
} from "@/components/order/OrderTermsBlock";
import Confirmation from "@/components/order/Confirmation";
import OrderJobTitleField, {
  isJobTitleValid,
} from "@/components/order/OrderJobTitleField";
import { redirectOnOrderAuthError } from "@/components/order/order-redirect";
import { submitOrder } from "@/lib/submit-order";
import Container from "@/components/layout/Container";
import {
  scrollDashboardToTop,
  scrollElementIntoViewWithinDashboard,
} from "@/lib/dashboard-scroll";
import {
  ITEM_REMOVAL_SUB_SERVICE,
  ITEM_REMOVAL_OPTION_ID,
  ITEM_REMOVAL_COMPLEXITY_NOTICE,
} from "@/lib/item-removal";
import ItemRemovalItemCard, {
  type ItemRemovalItemData,
  emptyItemRemovalItem,
  itemRemovalItemDomId,
  isItemRemovalItemValid,
} from "./ItemRemovalItemCard";
import ItemRemovalReview from "./ItemRemovalReview";

// ============================================================
// ItemRemovalOrderForm — dedicated Item Removal & Virtual Cleaning flow.
//
// Two client-side steps on the SAME protected route:
//   "configure" → upload + per-photo work types + instructions + markup
//   "review"    → read-only review + terms + the only Submit Order action
//
// Backend model is UNCHANGED: serviceType "photo-editing", fixed option
// item-removal-cleaning-pe (canonical fixed-currency price), PE order
// numbering, sub_service = item-removal-virtual-cleaning. Identity is
// sourced server-side (no "Your Details" block). The optional markup /
// reference image reuses the existing referenceFile upload pipeline and
// is NOT billed as a separate item.
// ============================================================

type ItemRemovalFormStep = "configure" | "review";

const STEPS: OrderStep[] = [
  { id: "configure", label: "Configure Order" },
  { id: "review", label: "Review & Submit" },
];

const SERVICE_NAME = "Item Removal & Virtual Cleaning";

interface ItemRemovalOrderFormProps {
  clientEmail: string;
  orderRoute: string;
}

export default function ItemRemovalOrderForm({
  clientEmail,
  orderRoute,
}: ItemRemovalOrderFormProps) {
  const [step, setStep] = useState<ItemRemovalFormStep>("configure");
  const [items, setItems] = useState<ItemRemovalItemData[]>([
    emptyItemRemovalItem(),
  ]);
  const [jobTitle, setJobTitle] = useState("");
  const [orderTerms, setOrderTerms] = useState<OrderTermsData>(emptyOrderTerms);
  const [attemptedReview, setAttemptedReview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Pending scroll action applied after a step transition renders. The
  // dashboard <main> (not the window) owns scrolling, so we target it.
  const pendingScrollRef = useRef<
    { type: "top" } | { type: "item"; index: number } | null
  >(null);

  useEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending) return;
    pendingScrollRef.current = null;
    const raf = requestAnimationFrame(() => {
      if (pending.type === "item") {
        scrollElementIntoViewWithinDashboard(itemRemovalItemDomId(pending.index));
      } else {
        scrollDashboardToTop();
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // --- Item mutations ---
  const handleItemChange = (index: number, data: ItemRemovalItemData) => {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  };

  const handleAddItem = () =>
    setItems((prev) => [...prev, emptyItemRemovalItem()]);

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Step transitions ---
  const goToReview = () => {
    // Validate the configure step. Inline per-photo errors appear on a
    // failed attempt; nothing is uploaded and no order is created here.
    if (!configureValid) {
      setAttemptedReview(true);
      return;
    }
    setSubmitError("");
    pendingScrollRef.current = { type: "top" };
    setStep("review");
  };

  const goToConfigureTop = () => {
    pendingScrollRef.current = { type: "top" };
    setStep("configure");
  };

  const handleEditItem = (index: number) => {
    pendingScrollRef.current = { type: "item", index };
    setStep("configure");
  };

  // --- Final submission (Review step only) ---
  const handleSubmit = async () => {
    if (isSubmitting) return; // guard against double submission
    setIsSubmitting(true);
    setSubmitError("");

    // Each item carries the fixed single option + the item-removal
    // sub-service + its typed work tasks and instructions. The server
    // re-validates the option matches the sub-service, validates the
    // task enum + instructions, and recalculates the price.
    const itemsMetadata = items.map((item) => ({
      subService: ITEM_REMOVAL_SUB_SERVICE,
      selectedOptions: [ITEM_REMOVAL_OPTION_ID],
      removalTasks: item.removalTasks,
      additionalInfo: item.additionalInfo,
      fileSizeLimit: item.fileSizeLimit,
      disclaimerText: item.disclaimerText,
    }));

    // Original + optional markup/reference file via the existing pipeline.
    const files = items.map((item) => ({
      file: item.file,
      referenceFile: item.referenceFile,
    }));

    const result = await submitOrder(
      "photo-editing",
      itemsMetadata,
      files,
      orderTerms,
      jobTitle
    );

    if (result.success && result.orderId && result.orderNumber) {
      setOrderId(result.orderId);
      setOrderNumber(result.orderNumber);
      setConfirmationEmailSent(result.confirmationEmailSent === true);
      setSubmitted(true);
      setIsSubmitting(false);
      return;
    }

    if (redirectOnOrderAuthError(result, orderRoute)) return;

    // Stay on Review, surface the error, retain files + all selections.
    setIsSubmitting(false);
    setSubmitError(result.error || "Submission failed. Please try again.");
  };

  const handleNewOrder = () => {
    setStep("configure");
    setItems([emptyItemRemovalItem()]);
    setJobTitle("");
    setOrderTerms(emptyOrderTerms);
    setAttemptedReview(false);
    setSubmitted(false);
    setOrderId("");
    setOrderNumber("");
    setSubmitError("");
  };

  // --- Validation ---
  const configureValid =
    items.length > 0 &&
    items.every(isItemRemovalItemValid) &&
    isJobTitleValid(jobTitle);
  const reviewValid = configureValid && orderTerms.accepted;

  // --- Summary ---
  const summaryItems: SummaryItem[] = items.map((_, i) => ({
    label: `Photo #${i + 1}`,
  }));

  if (submitted) {
    return (
      <section className="py-16 bg-surface">
        <Container>
          <Confirmation
            orderId={orderId}
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

  const isReview = step === "review";

  const sidebar = isReview ? (
    <OrderSummary
      serviceName={SERVICE_NAME}
      items={summaryItems}
      pricingInput={{
        serviceType: "photo-editing",
        items: items.map(() => ({
          selectedOptions: [ITEM_REMOVAL_OPTION_ID],
        })),
      }}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      canSubmit={reviewValid}
      submitLabel="Submit Order"
      submittingLabel="Submitting..."
    />
  ) : (
    <OrderSummary
      serviceName={SERVICE_NAME}
      items={summaryItems}
      pricingInput={{
        serviceType: "photo-editing",
        items: items.map(() => ({
          selectedOptions: [ITEM_REMOVAL_OPTION_ID],
        })),
      }}
      onSubmit={goToReview}
      isSubmitting={false}
      canSubmit
      submitLabel="Review Order"
      footerNote="No payment now. You'll confirm your order on the next step."
    />
  );

  return (
    <OrderLayout
      title="Item Removal & Virtual Cleaning"
      subtitle="Remove clutter, objects, vehicles and distractions, and virtually clean marks and imperfections so the space looks listing-ready."
      header={<OrderStepIndicator steps={STEPS} currentStepId={step} />}
      sidebar={sidebar}
    >
      {isReview ? (
        <ItemRemovalReview
          jobTitle={jobTitle}
          items={items}
          orderTerms={orderTerms}
          onTermsChange={setOrderTerms}
          onEditItem={handleEditItem}
          onBack={goToConfigureTop}
          submitError={submitError}
        />
      ) : (
        <>
          {submitError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
              {submitError}
            </div>
          )}

          <OrderJobTitleField value={jobTitle} onChange={setJobTitle} />

          {/* Complexity notice — shown in full on Configure. */}
          <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden />
            <p>{ITEM_REMOVAL_COMPLEXITY_NOTICE}</p>
          </div>

          <div className="space-y-5">
            {items.map((item, index) => (
              <ItemRemovalItemCard
                key={index}
                index={index}
                data={item}
                onChange={(data) => handleItemChange(index, data)}
                onRemove={() => handleRemoveItem(index)}
                canRemove={items.length > 1}
                showErrors={attemptedReview}
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
        </>
      )}
    </OrderLayout>
  );
}
