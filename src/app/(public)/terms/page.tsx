import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/layout/Container";
import { TERMS_VERSION } from "@/components/order/OrderTermsBlock";
import { localizedAlternates } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "PicchuSpot terms and conditions: scope of services, client responsibilities, revisions, turnaround, pricing, file delivery, copyright, liability, refunds, and how local services work.",
  alternates: localizedAlternates({
    canonicalPath: "/terms",
    englishPath: "/terms",
    spanishPath: "/es/terms",
  }),
};

/**
 * Terms & Conditions page.
 *
 * Original wording in our own neutral PicchuSpot voice. No
 * third-party branded text. Clean and readable, matches the rest of
 * the public site (premium navy + soft neutrals, generous spacing).
 *
 * The TERMS_VERSION constant is also recorded against every order at
 * submit time so the version a client agreed to can always be
 * recovered later.
 */

interface Section {
  id: string;
  title: string;
  body: React.ReactNode;
}

const sections: Section[] = [
  {
    id: "overview",
    title: "1. Overview",
    body: (
      <>
        <p>
          These terms cover orders placed with PicchuSpot for visual
          marketing services such as virtual staging, virtual renovation,
          floor plans, and photo editing, as well as on-location services
          where available. By submitting an order, you agree to the terms
          below on behalf of yourself and any company you represent.
        </p>
        <p>
          We use plain, practical language so you know exactly how we work.
          If anything is unclear, please contact us before placing an
          order.
        </p>
      </>
    ),
  },
  {
    id: "scope",
    title: "2. Scope of services",
    body: (
      <>
        <p>
          We offer remote digital services worldwide, including virtual
          staging, virtual renovation, 2D and 3D floor plans, and real
          estate photo editing. We also offer on-location media services
          (photography, video, 360 tours, drone where permitted) in
          selected areas such as Alicante and Costa Blanca.
        </p>
        <p>
          The exact scope of any single order is defined by what you
          select on the order form, the files and instructions you
          submit, and any written confirmation we provide.
        </p>
      </>
    ),
  },
  {
    id: "responsibilities",
    title: "3. Client responsibilities",
    body: (
      <>
        <p>By submitting an order, you confirm that:</p>
        <ul>
          <li>
            You have the right or permission to submit the photos, plans,
            sketches, drawings, logos, references, and any other materials
            you upload to us.
          </li>
          <li>
            You have the right to instruct edits and to use the resulting
            files for your intended marketing or listing purpose.
          </li>
          <li>
            You are responsible for how the final files are used in
            listings, MLS, marketing, advertising, social media, or any
            legal disclosures.
          </li>
          <li>
            Any information you provide (room labels, addresses,
            disclaimers, branding, etc.) is accurate.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "source-files",
    title: "4. Source files and instructions",
    body: (
      <>
        <p>
          Our work depends on the quality of what you send. Clear,
          well-lit photos, accurate measurements, and specific
          instructions produce the best results. Vague or incomplete
          instructions can cause delays, additional revisions, or
          interpretations that differ from what you had in mind.
        </p>
        <p>
          If we need to ask follow-up questions, we will do so before
          starting or pause the order until we receive what we need.
        </p>
      </>
    ),
  },
  {
    id: "revisions",
    title: "5. Revisions and additional work",
    body: (
      <>
        <p>
          One revision is included per item unless stated otherwise. A
          revision means small corrections that follow the original
          instructions, such as adjusting a colour we already chose or
          fixing a clearly identified mistake.
        </p>
        <p>
          New requests, changes of direction, or additions that go beyond
          the original instructions count as additional work and may
          require a separate quote. Significant rework caused by missing,
          unclear, or changed instructions may also be charged
          additionally. We always confirm any extra cost in writing
          before continuing.
        </p>
      </>
    ),
  },
  {
    id: "turnaround",
    title: "6. Turnaround times",
    body: (
      <>
        <p>
          Standard turnaround for digital services is 24–48 hours from
          when we have everything we need. Complex orders, large batches,
          and certain combinations of options may take longer. If a
          tighter deadline is required, please tell us before placing
          the order so we can confirm whether it is possible.
        </p>
        <p>
          Time spent waiting for files, instructions, or approvals does
          not count toward the turnaround estimate.
        </p>
      </>
    ),
  },
  {
    id: "pricing",
    title: "7. Pricing and invoices",
    body: (
      <>
        <p>
          Prices shown on the order form and the public pricing pages are
          in US dollars and exclude any local taxes that may apply. The
          estimated total at submission is based on what you selected.
          Final invoices may differ if additional work is approved or if
          a complex request requires a separate quote.
        </p>
        <p>
          Submitting an order does not charge your card. We confirm scope
          and invoice you separately. Any payment terms agreed in writing
          override the defaults below.
        </p>
      </>
    ),
  },
  {
    id: "delivery",
    title: "8. File delivery and storage",
    body: (
      <>
        <p>
          Final files are delivered as high-resolution JPGs unless we
          agree to a different format. Where you select a maximum
          delivery size for an item, we aim for that target while
          preserving image quality.
        </p>
        <p>
          We retain order files for a reasonable period to support
          revisions and reissue requests, but we do not guarantee
          long-term storage. Please download and back up your files
          promptly.
        </p>
      </>
    ),
  },
  {
    id: "ownership",
    title: "9. Copyright and ownership",
    body: (
      <>
        <p>
          You own the final delivered files for your order once payment
          is complete. You may use them for the marketing of the
          property they were created for, including listings, social
          media, brochures, websites, and similar marketing channels.
        </p>
        <p>
          You retain ownership of any materials you uploaded to us. We
          do not claim ownership of your photos, plans, or references.
          Background assets we use to produce the work (3D models,
          textures, decor libraries, software) remain ours or our
          licensors&apos;.
        </p>
      </>
    ),
  },
  {
    id: "portfolio",
    title: "10. Portfolio use and marketing permission",
    body: (
      <>
        <p>
          We may include before/after examples from delivered orders in
          our portfolio, website, or marketing materials, but only when
          you have explicitly given us permission to do so. The order
          form includes an optional checkbox for this; the default is
          off.
        </p>
        <p>
          When permission is given, we anonymize property details where
          possible and never display private contact information. You
          may withdraw permission for future use at any time by writing
          to us.
        </p>
      </>
    ),
  },
  {
    id: "accuracy",
    title: "11. Real estate marketing accuracy disclaimer",
    body: (
      <>
        <p>
          Virtual staging, virtual renovation, photo editing, and floor
          plans are visual tools to help buyers imagine a property. They
          show how a space could look, not how it currently looks. The
          delivered images and plans are not a substitute for an
          inspection, an appraisal, a survey, or formal building
          documentation.
        </p>
        <p>
          You are responsible for clearly disclosing virtually staged or
          edited images where required by your local rules, your MLS,
          and your professional obligations. We follow your instructions
          closely, but we cannot guarantee that every third-party
          platform, MLS, buyer, seller, or legal body will interpret
          edited images the same way.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "12. Limitation of liability",
    body: (
      <>
        <p>
          We provide services on a best-effort basis and stand behind the
          quality of our work. To the maximum extent permitted by law,
          our total liability for any claim arising out of an order is
          limited to the amount you paid for that order.
        </p>
        <p>
          We are not liable for indirect, incidental, or consequential
          losses, including lost listings, lost commissions, lost sales,
          or third-party claims, except where applicable law does not
          allow such limitation.
        </p>
      </>
    ),
  },
  {
    id: "refunds",
    title: "13. Refunds and cancellations",
    body: (
      <>
        <p>
          You can cancel an order at no cost before we begin work. Once
          work has started, cancellations are reviewed case by case and
          may be subject to a fee that reflects the time already spent.
        </p>
        <p>
          If a delivered file does not match the agreed scope, please
          tell us and we will fix it. We do not provide refunds for
          changes of mind, taste preferences that were not specified at
          order time, or third-party platform requirements that were not
          shared with us in advance.
        </p>
      </>
    ),
  },
  {
    id: "local",
    title: "14. Local services note",
    body: (
      <>
        <p>
          Prices listed for on-location services in Alicante and Costa
          Blanca are starting points only. The final quote depends on
          location, property size, scope, scheduling availability, any
          permissions required, and the specific deliverables you need.
          We confirm the quote in writing before booking the shoot or
          tour.
        </p>
        <p>
          Drone and aerial work is offered through a licensed specialist
          where regulations permit. Where drone flights are not legally
          allowed in a specific location, we will propose an alternative
          or decline that part of the brief.
        </p>
      </>
    ),
  },
  {
    id: "updates",
    title: "15. Updates to these terms",
    body: (
      <>
        <p>
          We may update these terms from time to time as our services
          evolve. The version that applies to your order is the one
          recorded against your order at submission time. Material
          changes will be reflected here with an updated version label.
        </p>
        <p>
          The current version of these terms is{" "}
          <strong className="font-semibold text-foreground">
            {TERMS_VERSION}
          </strong>
          .
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "16. Contact",
    body: (
      <>
        <p>
          Questions about these terms or about a specific order? Please{" "}
          <Link
            href="/contact"
            className="text-primary underline underline-offset-2 hover:text-primary-light"
          >
            contact us
          </Link>{" "}
          and we will get back to you.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <section className="py-16 lg:py-24 bg-stone-50">
      <Container>
        <div className="max-w-3xl mx-auto">
          <header className="mb-12 lg:mb-16">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
              Legal
            </p>
            <h1 className="text-3xl lg:text-5xl font-bold text-primary mb-4 tracking-tight leading-[1.1]">
              Terms &amp; Conditions
            </h1>
            <p className="text-base lg:text-lg text-muted leading-relaxed">
              These terms apply to any order placed with PicchuSpot.
              They are written to be clear and practical, not heavy with
              legal jargon. Please read them before submitting an order.
            </p>
            <p className="text-xs text-muted mt-4">
              Current version:{" "}
              <span className="font-semibold text-foreground">
                {TERMS_VERSION}
              </span>
            </p>
          </header>

          {/* Quick contents */}
          <nav
            aria-label="Terms contents"
            className="bg-white border border-stone-200 rounded-2xl p-5 lg:p-6 shadow-sm mb-12 lg:mb-16"
          >
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted mb-3">
              Contents
            </p>
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="text-sm text-foreground hover:text-primary transition-colors"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-12 lg:space-y-14">
            {sections.map((s) => (
              <article key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="text-xl lg:text-2xl font-bold text-primary mb-4 tracking-tight">
                  {s.title}
                </h2>
                <div className="text-sm lg:text-base text-foreground leading-relaxed space-y-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_p]:text-muted [&_li]:text-muted [&_strong]:text-foreground">
                  {s.body}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-16 lg:mt-20 pt-8 border-t border-stone-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <p className="text-xs text-muted">
              Last updated terms version{" "}
              <span className="font-semibold text-foreground">
                {TERMS_VERSION}
              </span>
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-5 py-2.5 border border-primary/25 text-primary text-sm font-semibold rounded-lg hover:bg-primary hover:text-white hover:border-primary transition-all"
            >
              Contact us
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
