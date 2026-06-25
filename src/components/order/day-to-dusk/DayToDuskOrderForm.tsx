"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
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
import type { ServiceOptionImage } from "@/lib/site-media";
import {
  DAY_TO_DUSK_SUB_SERVICE,
  DAY_TO_DUSK_OPTION_ID,
} from "@/lib/day-to-dusk";
import DayToDuskItemCard, {
  type DayToDuskItemData,
  emptyDayToDuskItem,
  dayToDuskItemDomId,
} from "./DayToDuskItemCard";
import DayToDuskReview from "./DayToDuskReview";
import ApplyToAllPreferencesToggle from "./ApplyToAllPreferencesToggle";

// ============================================================
// DayToDuskOrderForm — dedicated Day to Dusk order flow.
//
// Two client-side steps on the SAME protected route:
//   "configure"  → upload + per-photo preferences (no upload/submit here)
//   "review"     → read-only review + terms + the only Submit Order action
//
// Backend model is UNCHANGED: serviceType "photo-editing", fixed option
// day-to-dusk-pe (canonical fixed-currency price), PE order numbering, sub_service =
// day-to-dusk. Identity is sourced server-side (no "Your Details" block).
//
// FUTURE PAYMENT EXTENSION POINT: the flow is intentionally modelled as
// an ordered list of steps. A later PR can grow STEPS to
//   [configure, review, payment]
// and add a "payment" branch below WITHOUT restructuring this component.
// No payment UI / API / data is introduced in this PR.
// ============================================================

type DayToDuskFormStep = "configure" | "review";

const STEPS: OrderStep[] = [
  { id: "configure", label: "Configure Order" },
  { id: "review", label: "Review & Submit" },
  // FUTURE: { id: "payment", label: "Payment" },
];

const SERVICE_NAME = "Day to Dusk";

interface DayToDuskOrderFormProps {
  clientEmail: string;
  orderRoute: string;
  /** mediaKey → resolved dusk-style example image (admin-managed). */
  duskStyleImages: Record<string, ServiceOptionImage>;
}

/** The preferences shared by the global "use Photo #1 preferences" toggle. */
type SharedPrefs = Pick<
  DayToDuskItemData,
  | "duskStyle"
  | "turnOnInteriorLights"
  | "turnOnExteriorLights"
  | "addPoolLights"
  | "fileSizeLimit"
>;

function pickShared(item: DayToDuskItemData): SharedPrefs {
  return {
    duskStyle: item.duskStyle,
    turnOnInteriorLights: item.turnOnInteriorLights,
    turnOnExteriorLights: item.turnOnExteriorLights,
    addPoolLights: item.addPoolLights,
    fileSizeLimit: item.fileSizeLimit,
  };
}

/** Copy the source item's shared preferences onto every other item. */
function applySharedFrom(
  items: DayToDuskItemData[],
  sourceIndex: number
): DayToDuskItemData[] {
  const source = items[sourceIndex];
  if (!source) return items;
  const shared = pickShared(source);
  return items.map((item, i) =>
    i === sourceIndex ? item : { ...item, ...shared }
  );
}

export default function DayToDuskOrderForm({
  clientEmail,
  orderRoute,
  duskStyleImages,
}: DayToDuskOrderFormProps) {
  const [step, setStep] = useState<DayToDuskFormStep>("configure");
  const [items, setItems] = useState<DayToDuskItemData[]>([
    emptyDayToDuskItem(),
  ]);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [orderTerms, setOrderTerms] = useState<OrderTermsData>(emptyOrderTerms);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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
        scrollElementIntoViewWithinDashboard(dayToDuskItemDomId(pending.index));
      } else {
        scrollDashboardToTop();
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // --- Item mutations (respecting the global share toggle) ---
  const handleItemChange = (index: number, data: DayToDuskItemData) => {
    setItems((prev) => {
      const next = prev.map((item, i) => (i === index ? data : item));
      // While sharing is on, Photo #1 is the source of truth: propagate
      // its shared preferences to the rest immediately so nothing diverges.
      if (shareEnabled && index === 0) return applySharedFrom(next, 0);
      return next;
    });
  };

  const handleAddItem = () =>
    setItems((prev) => {
      const fresh = emptyDayToDuskItem();
      // Newly added photos inherit Photo #1's shared preferences.
      const newItem =
        shareEnabled && prev[0] ? { ...fresh, ...pickShared(prev[0]) } : fresh;
      return [...prev, newItem];
    });

  const handleRemoveItem = (index: number) => {
    setItems((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      // If Photo #1 was removed, the new first photo becomes the source —
      // reapply its shared preferences when sharing remains enabled.
      if (shareEnabled && filtered.length > 0) {
        return applySharedFrom(filtered, 0);
      }
      return filtered;
    });
  };

  const handleShareToggle = (checked: boolean) => {
    setShareEnabled(checked);
    // On enable, immediately copy Photo #1 values to all photos. On
    // disable, retain the currently copied values (do not reset).
    if (checked) setItems((prev) => applySharedFrom(prev, 0));
  };

  // --- Step transitions ---
  const goToReview = () => {
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

    // Stay on Review, surface the error, retain files + all selections.
    setIsSubmitting(false);
    setSubmitError(result.error || "Submission failed. Please try again.");
  };

  const handleNewOrder = () => {
    setStep("configure");
    setItems([emptyDayToDuskItem()]);
    setShareEnabled(false);
    setJobTitle("");
    setOrderTerms(emptyOrderTerms);
    setSubmitted(false);
    setOrderNumber("");
    setSubmitError("");
  };

  // --- Validation ---
  const configureValid =
    items.length > 0 &&
    items.every((item) => item.file !== null) &&
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
          selectedOptions: [DAY_TO_DUSK_OPTION_ID],
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
          selectedOptions: [DAY_TO_DUSK_OPTION_ID],
        })),
      }}
      onSubmit={goToReview}
      isSubmitting={false}
      canSubmit={configureValid}
      submitLabel="Review Order"
      footerNote="No payment now. You'll confirm your order on the next step."
    />
  );

  return (
    <OrderLayout
      title="Day to Dusk"
      subtitle="Transform daytime exterior photographs into warm, realistic twilight images with illuminated interiors and natural dusk skies."
      header={<OrderStepIndicator steps={STEPS} currentStepId={step} />}
      sidebar={sidebar}
    >
      {isReview ? (
        <DayToDuskReview
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
                sharedLocked={shareEnabled && index > 0}
              />
            ))}
          </div>

          {/* Single global Apply-to-All control — once, below the final
              photo card, only when there are 2+ photos. */}
          {items.length >= 2 && (
            <ApplyToAllPreferencesToggle
              checked={shareEnabled}
              onChange={handleShareToggle}
            />
          )}

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
