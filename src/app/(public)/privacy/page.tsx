import type { Metadata } from "next";
import Link from "next/link";
import TrackedOutboundLink from "@/components/analytics/TrackedOutboundLink";
import Container from "@/components/layout/Container";
import { localizedAlternates } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How PicchuSpot collects, uses, protects, and retains client account, order, communication, and uploaded real estate media information.",
  alternates: localizedAlternates({
    canonicalPath: "/privacy",
    englishPath: "/privacy",
    spanishPath: "/es/privacy",
  }),
};

const contactEmail = "hello@picchuspot.com";

const sections = [
  {
    title: "Introduction",
    body: (
      <>
        <p>
          This Privacy Policy explains how PicchuSpot handles information
          when you visit our website, create an account, place an order, upload
          files, or contact us about real estate visual services.
        </p>
        <p>
          This is practical launch copy intended to explain our current
          handling of information. It is not a legal guarantee, and we may
          update it as the service, tools, or legal requirements change.
        </p>
      </>
    ),
  },
  {
    title: "Information we collect",
    body: (
      <>
        <p>We may collect the following types of information:</p>
        <ul>
          <li>
            Account and contact information, such as your name, email address,
            phone number, company name, and profile details.
          </li>
          <li>
            Order details, including selected services, quantities, property
            or project notes, delivery preferences, estimated totals, and
            revision instructions.
          </li>
          <li>
            Uploaded files and images, including source photos, sketches,
            floor plan references, visual references, and review attachments.
          </li>
          <li>
            Communication data, such as emails, support requests, project
            questions, feedback, and revision comments.
          </li>
          <li>
            Basic technical data, such as browser type, device information,
            IP-derived logs, security events, and website usage data needed to
            operate and protect the service.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "How we use information",
    body: (
      <>
        <p>We use information to:</p>
        <ul>
          <li>Provide real estate visual services and manage client accounts.</li>
          <li>Process orders, confirm scope, and coordinate production.</li>
          <li>Communicate with clients about questions, status, and delivery.</li>
          <li>Deliver files, support revisions, and maintain order history.</li>
          <li>Improve the website, client portal, and service quality.</li>
          <li>
            Protect the service, investigate issues, enforce terms, and meet
            legal or security requirements.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "File uploads and real estate media",
    body: (
      <>
        <p>
          Uploaded real estate photos, plans, references, and finished files
          are used to complete the services you request. They may include
          property interiors, exteriors, addresses shown in filenames or notes,
          branding, or other project-specific details you choose to provide.
        </p>
        <p>
          We do not claim ownership of your uploaded files. We use them to
          produce, deliver, revise, and support your order. Portfolio or
          marketing use is handled separately and only when you explicitly
          give permission.
        </p>
      </>
    ),
  },
  {
    title: "Third-party services",
    body: (
      <>
        <p>
          PicchuSpot may use trusted service providers to operate the website,
          client portal, file storage, hosting, and communications. These may
          include Supabase for authentication, database, and storage services;
          Vercel for hosting and deployment; and Resend or another email
          provider for service emails. Crisp is used for live support when a
          visitor explicitly requests live human help, and Google Analytics is
          used for analytics when a visitor accepts analytics cookies.
        </p>
        <p>
          Google Analytics helps us understand basic website usage and
          conversion measurement only after analytics cookies are accepted.
          Analytics cookies may be rejected through the cookie controls.
        </p>
        <p>
          Crisp live support loads only when you explicitly ask to talk with a
          person. If you continue to live support, Crisp may receive your name,
          email address, current page path, recent AI chat context, and messages
          you enter into the native Crisp chat. Crisp may set a support-session
          cookie to keep the conversation connected; PicchuSpot configures this
          cookie with a 30-day expiration.
        </p>
        <p>
          You can decline live support and continue using the AI assistant or
          the contact page. The analytics cookie choice remains separate from
          the live-support action.
        </p>
      </>
    ),
  },
  {
    title: "Data retention",
    body: (
      <>
        <p>
          We keep account, order, communication, and file information for as
          long as reasonably needed to provide the service, support revisions,
          maintain business records, resolve disputes, and meet legal or
          security needs.
        </p>
        <p>
          Support communications, including messages handled through Crisp, may
          be retained as reasonably necessary to respond, maintain business
          records, resolve disputes, and meet legal or security needs.
        </p>
        <p>
          We do not guarantee permanent storage of delivered or uploaded files.
          Clients should download and back up finished files promptly.
        </p>
      </>
    ),
  },
  {
    title: "User choices and contact",
    body: (
      <>
        <p>
          You may contact us to ask about your information, request updates to
          account details, or ask whether certain files can be removed from
          active storage where practical and legally appropriate.
        </p>
        <p>
          For privacy questions, email{" "}
          <TrackedOutboundLink
            href={`mailto:${contactEmail}?subject=Privacy%20question`}
            analyticsLocation="contact_page"
            className="font-semibold text-primary hover:text-primary-light"
          >
            {contactEmail}
          </TrackedOutboundLink>
          .
        </p>
      </>
    ),
  },
  {
    title: "Security",
    body: (
      <p>
        We use practical technical and organizational measures designed to
        protect account data, order records, and uploaded files. No website,
        storage system, or transmission method is perfectly secure, but we
        work to limit access, use protected workflows, and keep sensitive
        service credentials server-side.
      </p>
    ),
  },
  {
    title: "International processing",
    body: (
      <p>
        PicchuSpot may process information using service providers and
        infrastructure located in countries different from where you live or
        work. By using the service, you understand that information may be
        handled across borders as needed to operate the website and deliver
        your order.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <Container>
        <div className="max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
            Privacy Policy
          </p>
          <h1 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05] mb-5">
            How we handle client and project information
          </h1>
          <p className="text-base lg:text-lg text-muted leading-relaxed">
            We collect only the information needed to run PicchuSpot, complete
            real estate visual orders, communicate clearly, and protect the
            service.
          </p>
          <p className="mt-5 text-sm text-muted">Last updated: June 30, 2026</p>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-8 lg:gap-12">
          <div className="space-y-6">
            {sections.map((section) => (
              <section
                key={section.title}
                className="bg-surface border border-border rounded-2xl p-6 lg:p-8"
              >
                <h2 className="text-xl font-bold text-primary mb-4">
                  {section.title}
                </h2>
                <div className="prose prose-sm max-w-none text-muted leading-relaxed [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-2">
                  {section.body}
                </div>
              </section>
            ))}
          </div>

          <aside className="lg:sticky lg:top-24 h-fit bg-white border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-primary mb-3">
              Privacy questions
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-5">
              For questions about this policy or your PicchuSpot account,
              contact us by email.
            </p>
            <TrackedOutboundLink
              href={`mailto:${contactEmail}?subject=Privacy%20question`}
              analyticsLocation="contact_page"
              className="inline-flex items-center justify-center w-full px-5 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors"
            >
              Email PicchuSpot
            </TrackedOutboundLink>
            <Link
              href="/terms"
              className="mt-3 inline-flex items-center justify-center w-full px-5 py-3 border border-border rounded-xl text-sm font-bold text-primary hover:border-primary/40 hover:bg-surface transition-colors"
            >
              View Terms
            </Link>
          </aside>
        </div>
      </Container>
    </section>
  );
}
