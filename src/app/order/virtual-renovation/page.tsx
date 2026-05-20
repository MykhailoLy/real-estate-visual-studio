"use client";

import { useState } from "react";
import { Plus, Info } from "lucide-react";
import OrderLayout from "@/components/order/OrderLayout";
import OrderSummary, { type SummaryItem } from "@/components/order/OrderSummary";
import ContactDetails, {
  type ContactData,
  emptyContactData,
} from "@/components/order/ContactDetails";
import Confirmation from "@/components/order/Confirmation";
import RenovationItemCard, {
  type RenovationItemData,
  emptyRenovationItem,
} from "@/components/order/virtual-renovation/RenovationItemCard";
import { calculateRenovationItemTotal } from "@/lib/pricing";
import { getOrderPrefix } from "@/lib/utils";
import Container from "@/components/layout/Container";

export default function VirtualRenovationOrderPage() {
  const [items, setItems] = useState<RenovationItemData[]>([emptyRenovationItem()]);
  const [contact, setContact] = useState<ContactData>(emptyContactData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  // --- Handlers ---
  const handleItemChange = (index: number, data: RenovationItemData) => {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  };

  const handleAddItem = () => setItems((prev) => [...prev, emptyRenovationItem()]);

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      const prefix = getOrderPrefix("virtual-renovation");
      const num = String(Math.floor(Math.random() * 9000) + 1000);
      setOrderNumber(`${prefix}-${num}`);
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1500);
  };

  const handleNewOrder = () => {
    setItems([emptyRenovationItem()]);
    setContact(emptyContactData);
    setSubmitted(false);
    setOrderNumber("");
  };

  // --- Validation ---
  const allItemsValid = items.every(
    (item) =>
      item.file !== null &&
      item.room !== "" &&
      (item.selectedInternal.length > 0 || item.selectedExternal.length > 0)
  );
  const contactValid =
    contact.name.length >= 2 &&
    contact.email.includes("@") &&
    contact.phone.length >= 6 &&
    contact.agreeTerms;
  const canSubmit = items.length > 0 && allItemsValid && contactValid;

  // --- Summary ---
  const summaryItems: SummaryItem[] = items.map((item, i) => ({
    label: item.room || `Image #${i + 1}`,
    subtotal: calculateRenovationItemTotal(item.selectedInternal, item.selectedExternal),
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
      title="Virtual Renovation"
      subtitle="Select renovation options for each image. Price is calculated based on your selections."
      sidebar={
        <OrderSummary
          serviceName="Virtual Renovation"
          items={summaryItems}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          canSubmit={canSubmit}
        />
      }
    >
      {/* Notice */}
      <div className="flex gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p>
          Some renovation edits may require custom review if the image involves
          major reconstruction or unclear source material. We will confirm the
          final price before starting.
        </p>
      </div>

      {/* Item Cards */}
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

      {/* Add Another */}
      <button
        type="button"
        onClick={handleAddItem}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted hover:text-primary hover:border-primary/40 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Another Image
      </button>

      {/* Contact Details */}
      <ContactDetails data={contact} onChange={setContact} />
    </OrderLayout>
  );
}
