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
import { getOrderPrefix } from "@/lib/utils";
import Container from "@/components/layout/Container";

export default function FloorPlansOrderPage() {
  const [items, setItems] = useState<FloorPlanItemData[]>([emptyFloorPlanItem()]);
  const [contact, setContact] = useState<ContactData>(emptyContactData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  // --- Handlers ---
  const handleItemChange = (index: number, data: FloorPlanItemData) => {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  };

  const handleAddItem = () => setItems((prev) => [...prev, emptyFloorPlanItem()]);

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      const prefix = getOrderPrefix("3d-floor-plans");
      const num = String(Math.floor(Math.random() * 9000) + 1000);
      setOrderNumber(`${prefix}-${num}`);
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1500);
  };

  const handleNewOrder = () => {
    setItems([emptyFloorPlanItem()]);
    setContact(emptyContactData);
    setSubmitted(false);
    setOrderNumber("");
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

  // --- Confirmation ---
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

  // --- Form ---
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
      {/* Item Cards */}
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

      {/* Add Another */}
      <button
        type="button"
        onClick={handleAddItem}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted hover:text-primary hover:border-primary/40 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Another Floor Plan
      </button>

      {/* Contact Details */}
      <ContactDetails data={contact} onChange={setContact} />
    </OrderLayout>
  );
}
