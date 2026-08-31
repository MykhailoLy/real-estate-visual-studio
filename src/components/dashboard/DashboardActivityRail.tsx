import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import ClientPortalLink from "./ClientPortalLink";
import SavedDraftsSection from "./SavedDraftsSection";
import type { DashboardJob } from "@/lib/client-dashboard/mock-data";

interface DashboardActivityRailProps {
  jobs: DashboardJob[];
}

const GETTING_STARTED_STEPS = [
  { label: "Upload", icon: Upload },
  { label: "Configure", icon: SlidersHorizontal },
  { label: "Review & submit", icon: ClipboardCheck },
  { label: "Download results", icon: Download },
] as const;

export default function DashboardActivityRail({
  jobs,
}: DashboardActivityRailProps) {
  const recentlyCompleted = jobs
    .filter((job) => job.status === "completed")
    .slice(0, 2);

  return (
    <aside
      aria-label="Order activity and getting started"
      className="space-y-8 lg:border-r lg:border-border lg:pr-8 xl:pr-10"
    >
      <SavedDraftsSection
        variant="rail"
        heading="Awaiting submission"
        helper="Continue a saved order when you are ready."
        carded
      />

      <section aria-labelledby="recently-completed-heading">
        <h2
          id="recently-completed-heading"
          className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary"
        >
          Recently completed
        </h2>
        {recentlyCompleted.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {recentlyCompleted.map((job) => (
              <li key={job.id}>
                <ClientPortalLink
                  href={`/dashboard/jobs/${job.id}`}
                  className="group flex min-h-11 items-start gap-3 rounded-xl border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs font-bold text-primary">
                      {job.reference}
                    </span>
                    <span className="mt-1 line-clamp-2 break-words text-sm font-bold leading-snug text-foreground group-hover:text-primary">
                      {job.serviceType}
                    </span>
                    <span className="mt-2 block text-[11px] text-muted">
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
          <p className="mt-3 rounded-xl border border-border bg-white p-4 text-xs leading-relaxed text-muted">
            Completed orders will appear here for quick access.
          </p>
        )}
        <ClientPortalLink
          href="/dashboard/jobs?status=completed"
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          View completed orders
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </ClientPortalLink>
      </section>

      <section aria-labelledby="getting-started-heading">
        <h2
          id="getting-started-heading"
          className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary"
        >
          How to get started
        </h2>
        <ol className="mt-3 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          {GETTING_STARTED_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.label}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <span className="font-mono text-xs font-bold tabular-nums text-secondary-dark">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/5 text-primary">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </aside>
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
