import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  FileQuestion,
  FileText,
  FolderOpen,
  HelpCircle,
  LifeBuoy,
  Mail,
  MessageCircle,
  RefreshCw,
  UserCircle,
} from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import { getDashboardRequestUser } from "@/lib/dashboard-request-context";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Support | PicchuSpot Client Portal",
};

const SUPPORT_EMAIL = "hello@picchuspot.com";

function SupportCard({
  title,
  body,
  href,
  cta,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
  icon: typeof LifeBuoy;
  iconClassName: string;
}) {
  return (
    <article className="bg-white border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-surface border border-border flex items-center justify-center flex-shrink-0">
          <Icon className={cn("h-4.5 w-4.5", iconClassName)} aria-hidden />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-foreground leading-snug">
            {title}
          </h2>
          <p className="text-sm text-muted leading-relaxed mt-1">{body}</p>
        </div>
      </div>
      <ClientPortalLink
        href={href}
        className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-bold text-white hover:bg-primary-light transition-colors"
      >
        {cta}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </ClientPortalLink>
    </article>
  );
}

function FaqCard({
  question,
  answer,
  icon: Icon,
}: {
  question: string;
  answer: string;
  icon: typeof HelpCircle;
}) {
  return (
    <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/6 border border-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
        </div>
        <div>
          <h3 className="text-[13px] font-bold text-foreground leading-snug">
            {question}
          </h3>
          <p className="text-xs text-muted leading-relaxed mt-1">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export default async function DashboardSupportPage() {
  const user = await getDashboardRequestUser();

  return (
    <ClientDashboardLayout>
      <div className="mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark mb-1.5">
          Client Portal
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
              Support
            </h1>
            <p className="text-muted mt-1 text-sm">
              Get help with orders, files, revisions, and account questions.
            </p>
            <p className="text-[12px] text-muted-light mt-1">
              For order-specific questions, include your order number so we can help faster.
            </p>
          </div>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors shadow-sm whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4" aria-hidden />
            Contact us
          </Link>
        </div>
      </div>

      {user ? (
        <div className="mb-6 bg-white border border-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <UserCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" aria-hidden />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-light">
                Signed in as
              </p>
              <p className="text-sm font-semibold text-foreground break-all">
                {user.email}
              </p>
            </div>
          </div>
          <ClientPortalLink
            href="/dashboard/jobs"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-[12px] font-semibold text-foreground/75 hover:border-primary/40 hover:text-primary transition-colors"
          >
            Need help with a specific order?
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </ClientPortalLink>
        </div>
      ) : (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Sign in to access order-specific support.
            </p>
            <p className="text-xs text-amber-700 mt-1">
              You can still contact us through the public contact page.
            </p>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-7">
        <SupportCard
          title="Order support"
          body="Questions about active orders, delivery timing, revisions, or uploaded files."
          href="/dashboard/jobs"
          cta="View my jobs"
          icon={Briefcase}
          iconClassName="text-primary"
        />
        <SupportCard
          title="File support"
          body="Help with download issues, missing files, preview problems, or file access."
          href="/dashboard/files"
          cta="View files"
          icon={FolderOpen}
          iconClassName="text-blue-600"
        />
        <SupportCard
          title="Billing / invoice support"
          body="Questions about estimated totals, invoice availability, or billing summaries."
          href="/dashboard/invoices"
          cta="View invoices"
          icon={FileText}
          iconClassName="text-secondary-dark"
        />
        <article className="bg-white border border-border rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-surface border border-border flex items-center justify-center flex-shrink-0">
              <LifeBuoy className="h-4.5 w-4.5 text-emerald-600" aria-hidden />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-foreground leading-snug">
                General contact
              </h2>
              <p className="text-sm text-muted leading-relaxed mt-1">
                Contact us through the contact page, or email us if you prefer a direct message.
              </p>
            </div>
          </div>
          <div className="mt-auto flex flex-col sm:flex-row gap-2">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-bold text-white hover:bg-primary-light transition-colors"
            >
              Contact page
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2 text-[13px] font-bold text-foreground/75 hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              Email support
            </a>
          </div>
        </article>
      </section>

      <section className="mb-7">
        <div className="flex items-center gap-2 mb-3">
          <FileQuestion className="w-4 h-4 text-primary" aria-hidden />
          <h2 className="text-sm font-bold text-foreground">Quick FAQ</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <FaqCard
            question="Where can I download delivered files?"
            answer="From the order detail page or the Files page in your dashboard."
            icon={FolderOpen}
          />
          <FaqCard
            question="How do I request a rework?"
            answer="Open the delivered file in your order and click Request rework."
            icon={RefreshCw}
          />
          <FaqCard
            question="Can I attach reference images to a rework request?"
            answer="Yes. Use the reference file upload inside the Request rework form."
            icon={CheckCircle2}
          />
          <FaqCard
            question="Where are invoices?"
            answer="Billing summaries are available in Invoices. Official downloadable invoices will be added later."
            icon={FileText}
          />
          <FaqCard
            question="Why can't I see a file?"
            answer="Make sure you are signed into the same account and email address used for the order."
            icon={AlertCircle}
          />
        </div>
      </section>

      <div className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" aria-hidden />
          <div>
            <p className="text-[13px] font-semibold text-foreground mb-1">
              Faster support checklist
            </p>
            <p className="text-xs text-muted leading-relaxed">
              Include your order number, the file name if relevant, what you expected to happen,
              and what you see instead. Clear details help us resolve the issue faster.
            </p>
          </div>
        </div>
      </div>
    </ClientDashboardLayout>
  );
}
