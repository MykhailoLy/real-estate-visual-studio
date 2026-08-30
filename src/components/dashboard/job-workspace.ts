import type {
  DashboardJob,
  DashboardJobStatus,
} from "@/lib/client-dashboard/mock-data";

export type JobsStatusFilter = DashboardJobStatus | "all";

export function getOpenDashboardJobs(
  jobs: DashboardJob[],
  limit = 3,
): DashboardJob[] {
  return jobs
    .filter(
      (job) => job.status !== "completed" && job.status !== "cancelled",
    )
    .slice(0, limit);
}

export function filterDashboardJobs(
  jobs: DashboardJob[],
  search: string,
  statusFilter: JobsStatusFilter,
): DashboardJob[] {
  const normalizedSearch = search.trim().toLowerCase();

  return jobs.filter((job) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      job.title.toLowerCase().includes(normalizedSearch) ||
      job.reference.toLowerCase().includes(normalizedSearch) ||
      job.serviceType.toLowerCase().includes(normalizedSearch) ||
      (job.secondaryLabel?.toLowerCase().includes(normalizedSearch) ?? false);
    const matchesStatus =
      statusFilter === "all" || job.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
}
