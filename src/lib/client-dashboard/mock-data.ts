// ============================================================
// CLIENT DASHBOARD — MOCK DATA
// Phase 1 shell: static data only, no Supabase connection.
// Replace with real queries when auth + DB are wired up.
// ============================================================

export type DashboardJobStatus =
  | "awaiting-submission"
  | "in-progress"
  | "revision-requested"
  | "pending-rework"
  | "rework-in-progress"
  | "new-version-ready"
  | "completed"
  | "cancelled";

export type DashboardServiceType =
  | "Virtual Staging"
  | "Floor Plans"
  | "Image Enhancement"
  | "Day to Dusk"
  | "Virtual Renovation"
  | "Item Removal & Virtual Cleaning";

export interface DashboardJob {
  id: string;
  title: string;
  /**
   * Optional secondary line shown beneath the title in the Jobs list,
   * e.g. "Image Enhancement — Single Exposure · PE-0004". Lets the
   * Job Title act as the headline while keeping the service + order
   * number visible. Omitted for mock jobs.
   */
  secondaryLabel?: string;
  reference: string;
  /**
   * Human-readable service label.
   * Typed as `string` (not the narrow DashboardServiceType union) so that
   * real orders mapped from DB slugs are accepted without a cast.
   * Mock jobs use DashboardServiceType values which are valid strings.
   */
  serviceType: string;
  status: DashboardJobStatus;
  submittedDate: string; // ISO date string  e.g. "2025-05-10"
  /**
   * ISO date string, "Delivered", "—", or "" for real orders where
   * no ETA column exists yet. JobsTable.formatDate handles non-ISO values.
   */
  estimatedCompletion: string;
  progress: number; // 0–100
  costCents: number; // cost in cents for formatUSD()
  imageCount: number;
}

export const MOCK_JOBS: DashboardJob[] = [
  {
    id: "job-001",
    title: "Paseo del Mar — Living Room Staging",
    reference: "VS-2025-0041",
    serviceType: "Virtual Staging",
    status: "completed",
    submittedDate: "2025-05-10",
    estimatedCompletion: "2025-05-12",
    progress: 100,
    costCents: 4900,
    imageCount: 4,
  },
  {
    id: "job-002",
    title: "Costa Blanca Villa — Floor Plan",
    reference: "FP-2025-0039",
    serviceType: "Floor Plans",
    status: "in-progress",
    submittedDate: "2025-05-22",
    estimatedCompletion: "2025-05-24",
    progress: 60,
    costCents: 3900,
    imageCount: 1,
  },
  {
    id: "job-003",
    title: "Altea Apartment — Photo Enhancement",
    reference: "IE-2025-0038",
    serviceType: "Image Enhancement",
    status: "in-progress",
    submittedDate: "2025-05-21",
    estimatedCompletion: "2025-05-23",
    progress: 40,
    costCents: 1800,
    imageCount: 9,
  },
  {
    id: "job-004",
    title: "Benidorm Penthouse — Day to Dusk",
    reference: "DD-2025-0037",
    serviceType: "Day to Dusk",
    status: "revision-requested",
    submittedDate: "2025-05-18",
    estimatedCompletion: "2025-05-20",
    progress: 80,
    costCents: 2400,
    imageCount: 3,
  },
  {
    id: "job-005",
    title: "Alicante Studio — Virtual Renovation",
    reference: "VR-2025-0035",
    serviceType: "Virtual Renovation",
    status: "awaiting-submission",
    submittedDate: "2025-05-28",
    estimatedCompletion: "2025-05-31",
    progress: 0,
    costCents: 5900,
    imageCount: 5,
  },
  {
    id: "job-006",
    title: "Torrevieja Beach House — Item Removal",
    reference: "IR-2025-0032",
    serviceType: "Item Removal & Virtual Cleaning",
    status: "completed",
    submittedDate: "2025-05-05",
    estimatedCompletion: "2025-05-07",
    progress: 100,
    costCents: 2100,
    imageCount: 7,
  },
  {
    id: "job-007",
    title: "Jávea Finca — Bedroom Staging",
    reference: "VS-2025-0028",
    serviceType: "Virtual Staging",
    status: "completed",
    submittedDate: "2025-04-28",
    estimatedCompletion: "2025-04-30",
    progress: 100,
    costCents: 3600,
    imageCount: 3,
  },
  {
    id: "job-008",
    title: "Dénia Townhouse — Image Enhancement",
    reference: "IE-2025-0025",
    serviceType: "Image Enhancement",
    status: "awaiting-submission",
    submittedDate: "2025-05-29",
    estimatedCompletion: "2025-06-01",
    progress: 0,
    costCents: 900,
    imageCount: 6,
  },
];

// ── Derived stats helpers ──────────────────────────────────

export function getDashboardStats(jobs: DashboardJob[]) {
  return {
    activeJobs: jobs.filter(
      (j) => j.status === "in-progress"
    ).length,
    awaitingSubmission: jobs.filter(
      (j) => j.status === "awaiting-submission"
    ).length,
    completedJobs: jobs.filter((j) => j.status === "completed").length,
    revisions: jobs.filter((j) =>
      [
        "revision-requested",
        "pending-rework",
        "rework-in-progress",
        "new-version-ready",
      ].includes(j.status)
    ).length,
  };
}

export const MOCK_CLIENT = {
  name: "Demo Client",
  firstName: "Demo",
  lastName: "Client",
  email: "demo@picchuspot.com",
  phone: "+34 600 000 000",
  company: "Demo Real Estate Agency",
  address: "Calle Mayor 1, Alicante, Spain",
  memberSince: "January 2025",
};

export const STATUS_LABELS: Record<DashboardJobStatus, string> = {
  "awaiting-submission": "Awaiting Submission",
  "in-progress": "In Progress",
  "revision-requested": "Revision Requested",
  "pending-rework": "Pending Rework",
  "rework-in-progress": "Rework in Progress",
  "new-version-ready": "New Version Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};
