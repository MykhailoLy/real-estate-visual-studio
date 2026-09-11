import type { Metadata } from "next";
import Link from "next/link";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import { ArrowRight, HelpCircle } from "lucide-react";
import Container from "@/components/layout/Container";
import { localizedAlternates } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import { faqPageSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about PicchuSpot ordering, turnaround times, revisions, file formats, delivery, billing summaries, and custom real estate visual services.",
  alternates: localizedAlternates({
    canonicalPath: "/faq",
    englishPath: "/faq",
    spanishPath: "/es/faq",
  }),
};

const faqs = [
  {
    question: "What services do you offer?",
    answer:
      "PicchuSpot provides real estate visual services including virtual staging, virtual renovation, 2D and 3D floor plans, photo editing, item removal, image enhancement, day-to-dusk editing, aerial editing, and selected custom or local media services.",
  },
  {
    question: "How do I place an order?",
    answer:
      "Start from the order page, choose the service that matches your project, upload your source files, add instructions, review the estimated total, and submit the order. We confirm scope and continue from there.",
  },
  {
    question: "What file types can I upload?",
    answer:
      "For most visual orders, upload clear JPG, PNG, HEIC, PDF, or common plan/reference files where accepted by the order form. If you have unusual files, contact us before ordering so we can confirm the best way to send them.",
  },
  {
    question: "How long does delivery take?",
    answer:
      "Many standard digital orders are delivered within 24 to 48 hours after we have the files and instructions needed to begin. Larger batches, complex renovation requests, missing information, or custom work can take longer.",
  },
  {
    question: "How do revisions work?",
    answer:
      "Unlimited revisions are included for 30 calendar days from first delivery when changes stay within the original brief, overall style, design direction, and original source materials. Specific colour, material, texture, furniture, object, and detail adjustments are included. A substantial redesign, most or all furniture replacements, new source images or angles, extra deliverables or services, or a materially expanded brief are new work; cumulative requests can also become a redesign. In the dashboard, some revision statuses may use the word rework to show the production stage.",
  },
  {
    question: "Can I attach reference images for revisions?",
    answer:
      "Yes. When revision references are available in the dashboard flow, attach images or notes that show the requested change clearly. Specific references help us make the right adjustment faster.",
  },
  {
    question: "Where can I download delivered files?",
    answer:
      "Delivered files are available in the client dashboard. Open your order or the Files page to preview and download finished files when delivery is ready.",
  },
  {
    question: "Do you provide invoices?",
    answer:
      "The dashboard shows billing summaries and estimated totals for orders. Official downloadable invoices are planned for a later release, so billing documents may be provided separately when needed.",
  },
  {
    question: "Do you offer real estate photo editing only?",
    answer:
      "Yes. You can order photo editing services without virtual staging or floor plans. Photo editing can include enhancement, object removal, virtual cleaning, sky replacement, day-to-dusk, and related listing image improvements.",
  },
  {
    question: "Do you offer custom or local services?",
    answer:
      "Yes. Contact us for custom visual requests, larger batches, local shoots, or property media needs that do not fit the standard order forms.",
  },
  {
    question: "How does the Welcome Offer work?",
    answer:
      "The Welcome Offer includes one free standalone Image Enhancement image, one free standalone Day to Dusk image, and 50% off one Virtual Staging image. Each independent benefit is available once per account and is applied automatically when eligible, with no coupon code. It applies only to the base service: add-ons stay full price, and the same image does not also receive a volume discount. Remaining paid images use the ordinary volume tiers.",
  },
  {
    question: "Do you offer volume discounts?",
    answer:
      "Yes. Discounts apply automatically to the base service subtotal: 1–4 eligible units use the standard price, 5–9 receive 5% off, 10–19 receive 10% off, 20–49 receive 15% off, and 50+ require a custom quote. Add-ons are not volume-discounted. For eligible fixed-price online orders, the amount shown in Stripe Checkout is tax-inclusive where applicable, and Stripe identifies the included tax. Custom quotes or manually invoiced services may state their own tax treatment.",
  },
  {
    question: "How do I contact support?",
    answer:
      "Email hello@picchuspot.com with your question. For existing orders, include the order reference and a short explanation so we can help quickly.",
  },
];

export default function FaqPage() {
  return (
    <>
      <JsonLd data={faqPageSchema(faqs)} />
      <section className="py-16 lg:py-24 bg-white">
      <Container>
        <div className="max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
            FAQ
          </p>
          <h1 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05] mb-5">
            Answers before you order
          </h1>
          <p className="text-base lg:text-lg text-muted leading-relaxed">
            Practical answers about PicchuSpot services, ordering, delivery,
            revisions, files, billing summaries, and support.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 lg:gap-12">
          <div className="space-y-4">
            {faqs.map((item) => (
              <article
                key={item.question}
                className="bg-surface border border-border rounded-2xl p-6 lg:p-7"
              >
                <div className="flex gap-4">
                  <div className="w-9 h-9 rounded-xl bg-white border border-border flex items-center justify-center flex-shrink-0">
                    <HelpCircle
                      className="w-4 h-4 text-secondary-dark"
                      aria-hidden
                    />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-primary mb-2">
                      {item.question}
                    </h2>
                    <p className="text-sm lg:text-base text-muted leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="lg:sticky lg:top-24 h-fit bg-white border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-primary mb-3">
              Need a direct answer?
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-5">
              Send us the project details, your deadline, and any files or
              references you already have.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors"
            >
              Contact support
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <ClientPortalLink
              href="/dashboard/orders/new"
              className="mt-3 inline-flex items-center justify-center gap-2 w-full px-5 py-3 border border-border rounded-xl text-sm font-bold text-primary hover:border-primary/40 hover:bg-surface transition-colors"
            >
              Start an order
            </ClientPortalLink>
          </aside>
        </div>
      </Container>
    </section>
    </>
  );
}
