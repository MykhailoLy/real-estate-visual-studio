import {
  ArrowRight,
  ClipboardCheck,
  Download,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import type { ReactNode } from "react";
import ClientPortalLink from "./ClientPortalLink";
import DashboardWelcomeOffer from "./DashboardWelcomeOffer";
import SavedDraftsSection from "./SavedDraftsSection";
import type { DashboardJob } from "@/lib/client-dashboard/mock-data";
import type { WelcomeOfferAvailability } from "@/lib/welcome-offer";

interface DashboardActivityRailProps {
  jobs: DashboardJob[];
  services: ReactNode;
  welcomeOfferAvailability: WelcomeOfferAvailability | null;
  isQaPreview: boolean;
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
  welcomeOfferAvailability,
  isQaPreview,
}: DashboardActivityRailProps) {
  const recentlyCompleted = jobs
    .filter((job) => job.status === "completed")
    .slice(0, 6);

  return (
    <div
      data-dashboard-workspace
      data-dashboard-activity-rail
      className="grid grid-cols-1 gap-6 lg:grid-cols-[clamp(20rem,33vw,36rem)_minmax(0,1fr)] lg:gap-x-6 xl:gap-x-8"
    >
      <aside className="contents lg:order-1 lg:block lg:self-start lg:space-y-6">
        <DashboardWelcomeOffer
          availability={welcomeOfferAvailability}
          className="order-1 lg:order-none"
        />

        <SavedDraftsSection
          variant="rail"
          heading="Awaiting submission"
          helper="Continue a saved order when you are ready."
          panel
          deletable
          listLimit={8}
          className="order-2 lg:order-none"
        />

        <section
          data-dashboard-section="recently-completed"
          aria-labelledby="recently-completed-heading"
          className="order-3 overflow-hidden rounded-xl border border-border bg-white shadow-sm lg:order-none"
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
                    href={isQaPreview ? "/dashboard/jobs" : `/dashboard/jobs/${job.id}`}
                    className="group flex min-h-11 items-center gap-2 px-3 py-2.5 transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
                        {job.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted">
                        {job.serviceType} · {job.reference}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted">
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
              href="/dashboard/jobs"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              View all jobs
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </ClientPortalLink>
          </div>
        </section>

        <section
          data-dashboard-section="getting-started"
          aria-labelledby="getting-started-heading"
          className="order-5 overflow-hidden rounded-xl border border-border bg-white shadow-sm lg:order-none"
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
      </aside>

      <div
        data-dashboard-services
        className="order-4 min-w-0 lg:order-2 lg:border-l lg:border-border lg:pl-6 xl:pl-8"
      >
        {services}
      </div>
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
