import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileCheck2,
  MessageSquareWarning,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import ClientPortalLink from "./ClientPortalLink";
import SavedDraftsSection from "./SavedDraftsSection";
import type {
  DashboardJob,
  DashboardJobStatus,
} from "@/lib/client-dashboard/mock-data";

interface DashboardActivityRailProps {
  jobs: DashboardJob[];
}

type ActionableStatus = Exclude<DashboardJobStatus, "completed" | "cancelled">;

interface ActionableStatusCopy {
  label: string;
  icon: LucideIcon;
  iconClassName: string;
}

const ACTIONABLE_STATUS_COPY: Record<ActionableStatus, ActionableStatusCopy> = {
  "awaiting-submission": {
    label: "Awaiting confirmation",
    icon: Clock3,
    iconClassName: "bg-amber-50 text-amber-700",
  },
  "in-progress": {
    label: "In production",
    icon: CalendarClock,
    iconClassName: "bg-blue-50 text-blue-700",
  },
  "revision-requested": {
    label: "Revision requested",
    icon: MessageSquareWarning,
    iconClassName: "bg-orange-50 text-orange-700",
  },
  "pending-rework": {
    label: "Revision queued",
    icon: RefreshCw,
    iconClassName: "bg-orange-50 text-orange-700",
  },
  "rework-in-progress": {
    label: "Rework in progress",
    icon: RefreshCw,
    iconClassName: "bg-sky-50 text-sky-700",
  },
  "new-version-ready": {
    label: "New version ready",
    icon: FileCheck2,
    iconClassName: "bg-violet-50 text-violet-700",
  },
};

function isActionableJob(
  job: DashboardJob,
): job is DashboardJob & { status: ActionableStatus } {
  return job.status !== "completed" && job.status !== "cancelled";
}

export default function DashboardActivityRail({
  jobs,
}: DashboardActivityRailProps) {
  const nextActions = jobs.filter(isActionableJob).slice(0, 3);
  const recentlyCompleted = jobs
    .filter((job) => job.status === "completed")
    .slice(0, 2);

  return (
    <aside
      aria-labelledby="continue-working-heading"
      className="self-start overflow-hidden rounded-xl border border-border bg-white shadow-sm"
    >
      <div className="border-b border-border px-4 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary-dark">
          Activity
        </p>
        <h2
          id="continue-working-heading"
          className="mt-1 text-lg font-bold text-primary"
        >
          Continue working
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Drafts and job updates that are ready for you.
        </p>
      </div>

      <div className="border-b border-border px-4 py-4">
        <SavedDraftsSection variant="rail" />
      </div>

      <section aria-labelledby="next-actions-heading" className="px-4 py-4">
        <h3 id="next-actions-heading" className="text-sm font-bold text-primary">
          Next actions
        </h3>
        {nextActions.length > 0 ? (
          <ul className="mt-2 divide-y divide-border">
            {nextActions.map((job) => {
              const statusCopy = ACTIONABLE_STATUS_COPY[job.status];
              const Icon = statusCopy.icon;
              return (
                <li key={job.id} className="py-3 first:pt-1 last:pb-0">
                  <ClientPortalLink
                    href={`/dashboard/jobs/${job.id}`}
                    className="group flex min-h-11 items-start gap-2.5 rounded-lg py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <span
                      className={`mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${statusCopy.iconClassName}`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold text-muted">
                        {statusCopy.label}
                      </span>
                      <span className="mt-0.5 line-clamp-2 break-words text-sm font-bold leading-snug text-foreground group-hover:text-primary">
                        {job.title}
                      </span>
                      <span className="mt-1 block truncate font-mono text-[10px] text-muted">
                        {job.serviceType} · {job.reference}
                      </span>
                    </span>
                    <ArrowRight
                      className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-muted-light group-hover:text-primary"
                      aria-hidden
                    />
                  </ClientPortalLink>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-2 flex items-start gap-2.5 rounded-lg bg-surface p-3">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600"
              aria-hidden
            />
            <p className="text-xs leading-relaxed text-muted">
              No job actions need your attention right now.
            </p>
          </div>
        )}
      </section>

      {recentlyCompleted.length > 0 && (
        <section
          aria-labelledby="recently-completed-heading"
          className="border-t border-border px-4 py-4"
        >
          <h3
            id="recently-completed-heading"
            className="text-sm font-bold text-primary"
          >
            Recently completed
          </h3>
          <ul className="mt-2 divide-y divide-border">
            {recentlyCompleted.map((job) => (
              <li key={job.id} className="py-3 first:pt-1 last:pb-0">
                <ClientPortalLink
                  href={`/dashboard/jobs/${job.id}`}
                  className="group flex min-h-11 items-start gap-2.5 rounded-lg py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <span className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 break-words text-sm font-bold leading-snug text-foreground group-hover:text-primary">
                      {job.title}
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-muted">
                      {job.serviceType} · {job.reference}
                    </span>
                    <span className="mt-1 block text-[11px] text-emerald-700">
                      Order from{" "}
                      <time dateTime={job.submittedDate}>
                        {formatCompactDate(job.submittedDate)}
                      </time>
                    </span>
                  </span>
                  <ArrowRight
                    className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-muted-light group-hover:text-primary"
                    aria-hidden
                  />
                </ClientPortalLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="border-t border-border px-4 py-3">
        <ClientPortalLink
          href="/dashboard/jobs"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          View all jobs
          <ArrowRight className="h-4 w-4" aria-hidden />
        </ClientPortalLink>
      </div>
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
