import { ArrowRight } from "lucide-react";
import ClientPortalLink from "./ClientPortalLink";
import { getOpenDashboardJobs } from "./job-workspace";
import SavedDraftsSection from "./SavedDraftsSection";
import StatusBadge from "./StatusBadge";
import type { DashboardJob } from "@/lib/client-dashboard/mock-data";

interface JobsWorkspaceRailProps {
  jobs: DashboardJob[];
}

export default function JobsWorkspaceRail({ jobs }: JobsWorkspaceRailProps) {
  const openJobs = getOpenDashboardJobs(jobs);

  return (
    <aside
      aria-label="Saved drafts and open jobs"
      className="self-start space-y-6"
    >
      <h2 className="sr-only">Jobs working rail</h2>

      <SavedDraftsSection
        variant="rail"
        workspace
        panel
        deletable
        listLimit={8}
      />

      <section
        aria-labelledby="open-jobs-heading"
        className="overflow-hidden rounded-xl border border-border bg-white px-4 py-4 shadow-sm"
      >
        <div>
          <h3
            id="open-jobs-heading"
            className="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary"
          >
            Open jobs
          </h3>
        </div>

        {openJobs.length > 0 ? (
          <ul className="mt-2 divide-y divide-border">
            {openJobs.map((job) => (
              <li key={job.id} className="py-3 first:pt-1 last:pb-0">
                <ClientPortalLink
                  href={`/dashboard/jobs/${job.id}`}
                  aria-label={`Open ${job.title}, ${job.reference}`}
                  className="dashboard-pointer-hover group block min-h-11 cursor-pointer rounded-lg px-2 py-2 transition-colors active:bg-ivory focus:bg-ivory focus:outline-none focus-visible:bg-ivory focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <span className="flex items-start justify-between gap-2">
                    <StatusBadge status={job.status} compact />
                    <ArrowRight
                      className="dashboard-pointer-hover-arrow mt-1 h-3.5 w-3.5 flex-shrink-0 text-secondary transition-colors group-focus-visible:translate-x-0.5 group-focus-visible:text-primary"
                      aria-hidden
                    />
                  </span>
                  <span className="dashboard-pointer-hover-title mt-2 block line-clamp-2 break-words text-sm font-bold leading-snug text-primary transition-colors group-focus-visible:text-primary-light">
                    {job.title}
                  </span>
                  <span className="mt-1 block break-words text-xs font-medium leading-snug text-foreground/80">
                    {job.serviceType}
                  </span>
                  <span className="mt-1.5 block truncate font-mono text-[10px] font-semibold text-foreground/80">
                    {job.reference}
                  </span>
                </ClientPortalLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-lg bg-surface p-3 text-xs leading-relaxed text-muted">
            No open jobs right now.
          </p>
        )}
      </section>
    </aside>
  );
}
