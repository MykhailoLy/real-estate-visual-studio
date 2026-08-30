import { ArrowRight, BriefcaseBusiness } from "lucide-react";
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
      className="self-start overflow-hidden rounded-xl border border-border bg-white shadow-sm"
    >
      <h2 className="sr-only">Jobs working rail</h2>

      <div className="border-b border-border px-4 py-4">
        <SavedDraftsSection variant="rail" />
      </div>

      <section aria-labelledby="open-jobs-heading" className="px-4 py-4">
        <div className="flex items-center gap-2">
          <BriefcaseBusiness
            className="h-4 w-4 text-secondary-dark"
            aria-hidden
          />
          <h3 id="open-jobs-heading" className="text-sm font-bold text-primary">
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
                  className="group block min-h-11 rounded-lg py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <span className="flex items-start justify-between gap-2">
                    <StatusBadge status={job.status} compact />
                    <ArrowRight
                      className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-muted-light transition-colors group-hover:text-primary"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-2 line-clamp-2 break-words text-sm font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
                    {job.title}
                  </span>
                  <span className="mt-1 block break-words text-xs leading-snug text-muted">
                    {job.serviceType}
                  </span>
                  <span className="mt-1.5 block truncate font-mono text-[10px] text-muted">
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
