import type {
  DashboardJob,
  DashboardJobStatus,
} from "@/lib/client-dashboard/mock-data";

export type JobsStatusFilter = DashboardJobStatus | "all";

function normalizeJobLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getDistinctJobSecondaryLabel(
  job: DashboardJob,
): string | null {
  const secondaryLabel = job.secondaryLabel?.trim();
  if (!secondaryLabel) return null;

  const visibleValues = new Set(
    [job.serviceType, job.reference]
      .map(normalizeJobLabel)
      .filter((value) => value.length > 0),
  );
  const secondaryParts = secondaryLabel
    .split("·")
    .map(normalizeJobLabel)
    .filter((value) => value.length > 0);

  const onlyRepeatsVisibleValues =
    secondaryParts.length > 0 &&
    secondaryParts.every((part) => visibleValues.has(part));

  return onlyRepeatsVisibleValues ? null : secondaryLabel;
}

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
