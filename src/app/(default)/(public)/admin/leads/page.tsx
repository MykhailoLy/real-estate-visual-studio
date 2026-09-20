import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Inbox, Mail, MapPin, Phone } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getPropertyLeadsForAdmin } from "@/features/property-showcase/property-leads-admin-server";
import type { AdminPropertyLead } from "@/features/property-showcase/property-leads-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Property Leads Admin | PicchuSpot",
  robots: { index: false, follow: false },
};

function formatSubmittedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatPreferredDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function notificationStatusClass(status: string | null): string {
  switch (status) {
    case "sent":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "failed":
      return "border-red-200 bg-red-50 text-red-800";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-border bg-surface text-muted";
  }
}

function LeadCard({ lead }: { lead: AdminPropertyLead }) {
  const preferredDate = formatPreferredDate(lead.preferredDate);
  const preferredTime = lead.preferredTime?.slice(0, 5) ?? null;

  return (
    <article className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary-dark">
            Property enquiry
          </p>
          <h2 className="mt-1 break-words text-lg font-bold text-primary">
            {lead.name}
          </h2>
          <time
            dateTime={lead.createdAt}
            className="mt-1 block text-sm text-muted"
          >
            Submitted {formatSubmittedAt(lead.createdAt)} UTC
          </time>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-foreground/75">
            {lead.locale.toUpperCase()}
          </span>
          <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-foreground/75">
            {lead.source}
          </span>
          {lead.notificationEmailStatus ? (
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${notificationStatusClass(lead.notificationEmailStatus)}`}
            >
              Email {lead.notificationEmailStatus}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-border pt-5 md:grid-cols-2">
        <section aria-label="Property">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Property
          </p>
          <Link
            href={`/property/${encodeURIComponent(lead.propertySlug)}`}
            className="mt-1 inline-flex break-all font-semibold text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {lead.propertySlug}
          </Link>
        </section>

        <section aria-label="Contact details" className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Contact
          </p>
          <div className="mt-1 space-y-1.5 text-sm">
            <a
              href={`mailto:${lead.email}`}
              className="flex w-fit max-w-full items-start gap-2 break-all text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Mail className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
              {lead.email}
            </a>
            {lead.phone ? (
              <a
                href={`tel:${lead.phone}`}
                className="flex w-fit max-w-full items-start gap-2 break-all text-foreground/80 underline decoration-border underline-offset-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Phone className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
                {lead.phone}
              </a>
            ) : null}
          </div>
        </section>

        {preferredDate || preferredTime ? (
          <section aria-label="Preferred viewing time">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
              Preferred viewing
            </p>
            <p className="mt-1 flex items-start gap-2 text-sm text-foreground/80">
              <CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-secondary-dark" aria-hidden />
              {[preferredDate, preferredTime].filter(Boolean).join(" at ")}
            </p>
          </section>
        ) : null}

        <section aria-label="Property context">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Property context
          </p>
          <p className="mt-1 flex items-start gap-2 text-sm text-foreground/80">
            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-secondary-dark" aria-hidden />
            Property showcase enquiry
          </p>
        </section>
      </div>

      {lead.message ? (
        <section className="mt-5 border-t border-border pt-5" aria-label="Lead message">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Message
          </p>
          <p className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-surface px-4 py-3 text-sm leading-6 text-foreground/80">
            {lead.message}
          </p>
        </section>
      ) : null}
    </article>
  );
}

export default async function AdminLeadsPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const result = await getPropertyLeadsForAdmin();

  if (result.state === "unconfigured") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
        <h2 className="text-lg font-bold">Leads inbox is not configured</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6">
          Supabase server configuration is required before property enquiries can be displayed.
        </p>
      </div>
    );
  }

  if (result.state === "unavailable") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
        <h2 className="text-lg font-bold">Leads inbox is temporarily unavailable</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6">
          The property leads schema could not be read. Confirm the existing database configuration and schema, then try again.
        </p>
      </div>
    );
  }

  if (result.leads.length === 0) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-primary">
          <Inbox className="h-5 w-5" aria-hidden />
        </div>
        <h2 className="mt-5 text-lg font-bold text-primary">No property enquiries yet.</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">
          New viewing requests from published property showcase pages will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        {result.leads.length} property {result.leads.length === 1 ? "enquiry" : "enquiries"}, newest first.
      </p>
      <div className="space-y-4">
        {result.leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
      </div>
    </div>
  );
}
