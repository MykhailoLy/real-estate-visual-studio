"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import Container from "@/components/layout/Container";
import ServiceSelector from "@/components/order/ServiceSelector";
import ItemCard, { createEmptyItem, type ItemData } from "@/components/order/ItemCard";
import ContactDetails, { type ContactData } from "@/components/order/ContactDetails";
import OrderSummary from "@/components/order/OrderSummary";
import Confirmation from "@/components/order/Confirmation";
import { getOrderPrefix } from "@/lib/utils";
import type { RemoteServiceType } from "@/types";

export default function OrderPage() {
  // --- State ---
  const [serviceType, setServiceType] = useState<RemoteServiceType | null>(null);
  const [items, setItems] = useState<ItemData[]>([createEmptyItem()]);
  const [contact, setContact] = useState<ContactData>({
    name: "",
    email: "",
    phone: "",
    company: "",
    agreeTerms: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  // --- Handlers ---
  const handleServiceSelect = (type: RemoteServiceType) => {
    setServiceType(type);
    // Reset items when service changes
    setItems([createEmptyItem()]);
  };

  const handleItemChange = (index: number, data: ItemData) => {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    // Mock submit — no backend call
    setIsSubmitting(true);
    setTimeout(() => {
      const prefix = serviceType ? getOrderPrefix(serviceType) : "ORD";
      const number = `${prefix}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, "0")}`;
      setOrderNumber(number);
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1500);
  };

  const handleNewOrder = () => {
    setServiceType(null);
    setItems([createEmptyItem()]);
    setContact({ name: "", email: "", phone: "", company: "", agreeTerms: false });
    setSubmitted(false);
    setOrderNumber("");
  };

  // --- Validation ---
  const hasValidItems = items.length > 0 && items.every((item) => item.originalFile !== null);
  const hasValidContact =
    contact.name.length >= 2 &&
    contact.email.includes("@") &&
    contact.phone.length >= 6 &&
    contact.agreeTerms;
  const canSubmit = serviceType !== null && hasValidItems && hasValidContact;

  // --- Confirmation State ---
  if (submitted) {
    return (
      <section className="py-16">
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

  // --- Main Form ---
  return (
    <section className="py-10 lg:py-16 bg-surface min-h-screen">
      <Container>
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-primary mb-2">
            Order Remote Services
          </h1>
          <p className="text-muted">
            Upload your photos, select preferences, and receive results in
            24-48 hours.
          </p>
        </div>

        {/* Main Layout: Form + Sidebar */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left: Form */}
          <div className="flex-1 space-y-8">
            {/* Step 1: Service Selector */}
            <div className="bg-white border border-border rounded-xl p-5 sm:p-6">
              <ServiceSelector
                selected={serviceType}
                onSelect={handleServiceSelect}
              />
            </div>

            {/* Step 2: Items (only shown after service selection) */}
            {serviceType && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Step 2: Add Images
                    </h2>
                    <p className="text-sm text-muted">
                      Upload one photo per item card.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {items.map((item, index) => (
                    <ItemCard
                      key={index}
                      index={index}
                      serviceType={serviceType}
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
                  className="mt-4 w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted hover:text-primary hover:border-primary/40 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Image
                </button>
              </div>
            )}

            {/* Step 3: Contact Details (only shown after service selection) */}
            {serviceType && (
              <div className="bg-white border border-border rounded-xl p-5 sm:p-6">
                <ContactDetails data={contact} onChange={setContact} />
              </div>
            )}
          </div>

          {/* Right: Sticky Order Summary (desktop) */}
          <div className="lg:w-80">
            <div className="lg:sticky lg:top-24">
              <OrderSummary
                serviceType={serviceType}
                itemCount={items.length}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                canSubmit={canSubmit}
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
