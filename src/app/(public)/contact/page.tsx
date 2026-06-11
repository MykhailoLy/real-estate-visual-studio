import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  FolderOpen,
  LifeBuoy,
  Mail,
  MapPin,
} from "lucide-react";
import TrackedLink from "@/components/analytics/TrackedLink";
import TrackedOutboundLink from "@/components/analytics/TrackedOutboundLink";
import Container from "@/components/layout/Container";
import { localizedAlternates } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact PicchuSpot",
  description:
    "Contact PicchuSpot for real estate visual service quotes, existing order support, and custom or local media requests.",
  alternates: localizedAlternates({
    canonicalPath: "/contact",
    englishPath: "/contact",
    spanishPath: "/es/contact",
  }),
};

const contactEmail = "hello@picchuspot.com";

const contactCards = [
  {
    icon: Building2,
    title: "New project or quote",
    description:
      "Send project details, service needs, quantities, deadlines, and any reference material you already have.",
    subject: "New project quote",
    body: "Hi PicchuSpot,%0D%0A%0D%0AI would like a quote for:%0D%0AService:%0D%0AQuantity:%0D%0ADeadline:%0D%0AProject notes:%0D%0A",
  },
  {
    icon: LifeBuoy,
    title: "Existing order support",
    description:
      "Include your order reference and a short note so we can find the right project quickly.",
    subject: "Existing order support",
    body: "Hi PicchuSpot,%0D%0A%0D%0AI need help with an existing order.%0D%0AOrder reference:%0D%0AQuestion:%0D%0A",
  },
  {
    icon: MapPin,
    title: "Local or custom services",
    description:
      "Ask about local shoots, custom visual work, unusual property media needs, or larger batches.",
    subject: "Local or custom service request",
    body: "Hi PicchuSpot,%0D%0A%0D%0AI would like to discuss a local or custom request.%0D%0ALocation:%0D%0AService needed:%0D%0ATimeline:%0D%0A",
  },
];

export default function ContactPage() {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-10 lg:gap-16 items-start">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
              Contact
            </p>
            <h1 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05] mb-5">
              Tell us what you need for your listing or property project
            </h1>
            <p className="text-base lg:text-lg text-muted leading-relaxed max-w-3xl">
              Contact PicchuSpot for remote visual services, quote questions,
              existing order support, or local and custom real estate media
              requests. We usually reply within 1 business day.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <TrackedLink
                href="/order"
                analyticsLabel="Start an order"
                analyticsLocation="contact_page"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors shadow-sm"
              >
                Start an order
                <ArrowRight className="w-4 h-4" aria-hidden />
              </TrackedLink>
              <TrackedLink
                href="/pricing"
                analyticsLabel="View pricing"
                analyticsLocation="contact_page"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl text-sm font-bold text-primary hover:border-primary/40 hover:bg-surface transition-colors"
              >
                View pricing
              </TrackedLink>
              <Link
                href="/dashboard/jobs"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-xl text-sm font-bold text-primary hover:border-primary/40 hover:bg-surface transition-colors"
              >
                Client dashboard
              </Link>
            </div>
          </div>

          <aside className="bg-surface border border-border rounded-2xl p-6 lg:p-8">
            <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center mb-5">
              <Mail className="w-5 h-5" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-primary mb-3">
              Email PicchuSpot
            </h2>
            <TrackedOutboundLink
              href={`mailto:${contactEmail}?subject=PicchuSpot%20inquiry`}
              analyticsLocation="contact_page"
              className="text-lg font-bold text-primary hover:text-primary-light break-all"
            >
              {contactEmail}
            </TrackedOutboundLink>
            <p className="mt-4 text-sm text-muted leading-relaxed">
              Share the service you need, the number of images or plans, your
              deadline, and any project notes. For order support, include your
              order reference.
            </p>
          </aside>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
          {contactCards.map((card) => (
            <article
              key={card.title}
              className="bg-white border border-border rounded-2xl p-6 shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center mb-5">
                <card.icon className="w-5 h-5 text-secondary-dark" aria-hidden />
              </div>
              <h2 className="text-lg font-bold text-primary mb-2">
                {card.title}
              </h2>
              <p className="text-sm text-muted leading-relaxed mb-5">
                {card.description}
              </p>
              <TrackedOutboundLink
                href={`mailto:${contactEmail}?subject=${encodeURIComponent(
                  card.subject
                )}&body=${card.body}`}
                analyticsLocation="contact_page"
                className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary-light transition-colors"
              >
                Email about this
                <ArrowRight className="w-4 h-4" aria-hidden />
              </TrackedOutboundLink>
            </article>
          ))}
        </div>

        <div className="mt-10 bg-primary rounded-2xl p-6 lg:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-secondary text-xs font-bold uppercase tracking-[0.18em] mb-2">
              <FolderOpen className="w-4 h-4" aria-hidden />
              Existing clients
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-white">
              Looking for delivered files or order updates?
            </h2>
          </div>
          <Link
            href="/dashboard/jobs"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-primary-dark rounded-xl text-sm font-bold hover:bg-secondary-light transition-colors"
          >
            Open dashboard
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </Container>
    </section>
  );
}
