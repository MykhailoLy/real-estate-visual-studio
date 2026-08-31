import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import type { ReactNode } from "react";
import ClientPortalLink from "./ClientPortalLink";
import SavedDraftsSection from "./SavedDraftsSection";
import type { DashboardJob } from "@/lib/client-dashboard/mock-data";

interface DashboardActivityRailProps {
  jobs: DashboardJob[];
  services: ReactNode;
}

const GETTING_STARTED_STEPS = [
  {
    label: "Upload",
    description: "Add your property photos or source files.",
    icon: Upload,
  },
  {
    label: "Configure",
    description:
      "Choose the service options and add any references or instructions.",
    icon: SlidersHorizontal,
  },
  {
    label: "Review & Submit",
    description: "Check the order details before submitting.",
    icon: ClipboardCheck,
  },
  {
    label: "Receive Results",
    description:
      "Track the job in your dashboard and download completed files when ready.",
    icon: Download,
  },
] as const;

export default function DashboardActivityRail({
  jobs,
  services,
}: DashboardActivityRailProps) {
  const recentlyCompleted = jobs
    .filter((job) => job.status === "completed")
    .slice(0, 2);

  return (
    <div
      data-dashboard-workspace
      data-dashboard-activity-rail
      className="relative grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-x-0 lg:gap-y-6 lg:before:pointer-events-none lg:before:absolute lg:before:inset-y-0 lg:before:left-[299px] lg:before:w-px lg:before:bg-border lg:before:content-[''] xl:grid-cols-[320px_minmax(0,1fr)] xl:before:left-[319px]"
    >
      <SavedDraftsSection
        variant="rail"
        heading="Awaiting submission"
        helper="Continue a saved order when you are ready."
        panel
        deletable
        className="order-1 lg:col-start-1 lg:row-start-1 lg:mr-8 xl:mr-10"
      />

      <section
        data-dashboard-section="recently-completed"
        aria-labelledby="recently-completed-heading"
        className="order-2 overflow-hidden rounded-xl border border-border bg-white shadow-sm lg:col-start-1 lg:row-start-2 lg:mr-8 xl:mr-10"
      >
        <div className="border-b border-border px-4 py-4">
          <h2
            id="recently-completed-heading"
            className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary"
          >
            Recently completed
          </h2>
        </div>
        {recentlyCompleted.length > 0 ? (
          <ul className="divide-y divide-border">
            {recentlyCompleted.map((job) => (
              <li key={job.id}>
                <ClientPortalLink
                  href={`/dashboard/jobs/${job.id}`}
                  className="group flex min-h-11 items-start gap-3 px-4 py-3 transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 break-words text-sm font-bold leading-snug text-foreground group-hover:text-primary">
                      {job.title}
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-muted">
                      {job.serviceType} · {job.reference}
                    </span>
                    <span className="mt-1.5 block text-[11px] text-muted">
                      Submitted{" "}
                      <time dateTime={job.submittedDate}>
                        {formatCompactDate(job.submittedDate)}
                      </time>
                    </span>
                  </span>
                  <ArrowRight
                    className="mt-1 h-4 w-4 flex-shrink-0 text-muted-light transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden
                  />
                </ClientPortalLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-5 text-xs leading-relaxed text-muted">
            Completed orders will appear here for quick access.
          </p>
        )}
        <div className="border-t border-border px-3 py-2">
          <ClientPortalLink
            href="/dashboard/jobs?status=completed"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            View completed orders
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </ClientPortalLink>
        </div>
      </section>

      <div
        data-dashboard-services
        className="order-3 min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:pl-8 xl:pl-10"
      >
        {services}
      </div>

      <section
        data-dashboard-section="getting-started"
        aria-labelledby="getting-started-heading"
        className="order-4 overflow-hidden rounded-xl border border-border bg-white shadow-sm lg:col-start-1 lg:row-start-3 lg:mr-8 xl:mr-10"
      >
        <div className="border-b border-border px-4 py-4">
          <h2
            id="getting-started-heading"
            className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary"
          >
            How to get started
          </h2>
        </div>
        <ol className="divide-y divide-border">
          {GETTING_STARTED_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.label}
                className="flex items-start gap-3 px-4 py-3"
              >
                <span className="mt-1 font-mono text-xs font-bold tabular-nums text-secondary-dark">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/5 text-primary">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    {step.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                    {step.description}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function formatCompactDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
