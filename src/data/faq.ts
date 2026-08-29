import type { FaqItem } from "@/types";

/**
 * Frequently Asked Questions
 */
export const faqItems: FaqItem[] = [
  {
    id: "faq-1",
    question: "How does the online ordering process work?",
    answer:
      "Select your service, upload your photos, choose your preferences, and submit. We review your order and confirm within 2 hours. No upfront payment required — we invoice after confirmation.",
    category: "ordering",
  },
  {
    id: "faq-2",
    question: "How long does delivery take?",
    answer:
      "Standard delivery is 24-48 hours for most remote services. Rush delivery (same day) is available for an additional fee. Local photography sessions are scheduled based on availability.",
    category: "delivery",
  },
  {
    id: "faq-3",
    question: "What file formats do you deliver?",
    answer:
      "Virtual staging, renovation, and photo editing are delivered as high-resolution JPG files. Floor plans come in both PDF and JPG formats. Video tours are delivered as MP4 files.",
    category: "delivery",
  },
  {
    id: "faq-4",
    question: "Are revisions included?",
    answer:
      "Yes, one revision is included with every order. Additional revisions may incur extra charges depending on the scope of changes requested.",
    category: "general",
  },
  {
    id: "faq-5",
    question: "What areas do you cover for local services?",
    answer:
      "We cover all of Alicante province and Costa Blanca, including Alicante city, Benidorm, Torrevieja, Javea, Denia, Calpe, Orihuela Costa, Elche, Santa Pola, and Villajoyosa. Travel fees may apply for locations over 30km from Alicante city.",
    category: "local-services",
  },
  {
    id: "faq-6",
    question: "Do you offer volume discounts?",
    answer:
      "Yes. Discounts apply automatically to the base service subtotal: 1–4 eligible units use the standard price, 5–9 receive 5% off, 10–19 receive 10% off, 20–49 receive 15% off, and 50+ require a custom quote. Add-ons are not volume-discounted. For eligible fixed-price online orders, the amount shown in Stripe Checkout is tax-inclusive where applicable, and Stripe identifies the included tax. Custom quotes or manually invoiced services may state their own tax treatment.",
    category: "pricing",
  },
  {
    id: "faq-7",
    question: "Can I order remote services from outside Spain?",
    answer:
      "Absolutely! Our remote digital services (virtual staging, renovation, floor plans, photo editing) are available worldwide. Just upload your photos and we handle the rest.",
    category: "general",
  },
  {
    id: "faq-8",
    question: "Is drone photography available everywhere?",
    answer:
      "Drone photography is only available where local flight regulations permit. We assess each location individually and will inform you if there are restrictions in your area.",
    category: "local-services",
  },
];
