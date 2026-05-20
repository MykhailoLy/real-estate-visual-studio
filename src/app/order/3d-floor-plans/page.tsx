"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import OrderLayout from "@/components/order/OrderLayout";
import OrderSummary, { type SummaryItem } from "@/components/order/OrderSummary";
import ContactDetails, {
  type ContactData,
  emptyContactData,
} from "@/components/order/ContactDetails";
import Confirmation from "@/components/order/Confirmation";
import FloorPlanItemCard, {
  type FloorPlanItemData,
  emptyFloorPlanItem,
} from "@/components/order/floor-plans/FloorPlanItemCard";
import { calculateFloorPlanItemTotal } from "@/lib/pricing";
import { submitOrder } from "@/lib/submit-order";
import Container from "@/components/layout/Container";

export default function FloorPlansOrderPage() {
  const [items, setItems] = useState<FloorPlanItemData[]>([emptyFloorPlanItem()]);
  const [contact, setContact] = useState<ContactData>(emptyContactData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [submitError, setSubmitError] = useState("");

  const handleItemChange = (index: number, data: FloorPlanItemData) => {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  };

  const handleAddItem = () => setItems((prev) => [...prev, emptyFloorPlanItem()]);

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");

    const itemsMetadata = items.map((item) => ({
      planType: item.planType,
      numberOfFloors: item.numberOfFloors,
      style3d: item.style3d,
      planView3d: item.planView3d,
      pageOrientation: item.pageOrientation,
      planOrientation: item.planOrientation,
      flooringByRoom: item.flooringByRoom,
      showAddress: item.showAddress,
      streetAddress: item.streetAddress,
      showTitle: item.showTitle,
      projectTitle: item.projectTitle,
      disclaimerOption: item.disclaimerOption,
      customDisclaimer: item.customDisclaimer,
      referenceLink: item.referenceLink,
      additionalInfo: item.additionalInfo,
    }));

    const files = items.map((item) => ({
      file: item.file,
      referenceFile: item.referenceFile,
    }));

    const result = await submitOrder("3d-floor-plans", contact, itemsMetadata, files);

    setIsSubmitting(false);
    if (result.success && result.orderNumber) {
      setOrderNumber(result.orderNumber);
      setSubmitted(true);
    } else {
      setSubmitError(result.error || "Submission failed. Please try again.");
    }
  };

  const handleNewOrder = () => {
    setItems([emptyFloorPlanItem()]);
    setContact(emptyContactData);
    setSubmitted(false);
    setOrderNumber("");
    setSubmitError("");
  };

  // --- Validation ---
  const allItemsValid = items.every(
    (item) =>
      item.file !== null &&
      item.planType !== "" &&
      item.numberOfFloors >= 1 &&
      item.pageOrientation !== "" &&
      item.planOrientation !== ""
  );
  const contactValid =
    contact.name.length >= 2 &&
    contact.email.includes("@") &&
    contact.phone.length >= 6 &&
    contact.agreeTerms;
  const canSubmit = items.length > 0 && allItemsValid && contactValid;

  // --- Summary ---
  const summaryItems: SummaryItem[] = items.map((item, i) => ({
    label: `Plan #${i + 1} (${item.numberOfFloors} floor${item.numberOfFloors > 1 ? "s" : ""})`,
    subtotal: calculateFloorPlanItemTotal(item.planType, item.numberOfFloors),
  }));

  if (submitted) {
    return (
      <section className="py-16 bg-surface min-h-screen">
        <Container>
          <Confirmation
            orderNumber={orderNumber}
            email={contact.email}
            onNewOrder={handleNewOrder}
          />
        </Container>
      </section>
    );
  }

  return (
    <OrderLayout
      title="2D / 3D Floor Plans"
      subtitle="Upload your floor plan, sketch, or photos. Price is based on plan type and number of floors."
      sidebar={
        <OrderSummary
          serviceName="2D / 3D Floor Plans"
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
          <FloorPlanItemCard
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
        Add Another Floor Plan
      </button>

      <ContactDetails data={contact} onChange={setContact} />
    </OrderLayout>
  );
}
