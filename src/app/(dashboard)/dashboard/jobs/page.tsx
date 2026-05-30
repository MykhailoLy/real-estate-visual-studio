import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import JobsTable from "@/components/dashboard/JobsTable";
import { MOCK_JOBS } from "@/lib/client-dashboard/mock-data";

export const metadata = {
  title: "Jobs | PicchuSpot Client Portal",
};

export default function DashboardJobsPage() {
  return (
    <ClientDashboardLayout showStatusFilter>
      {/* Page header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary-dark mb-1">
          Client Portal
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary leading-tight">
          Jobs
        </h1>
        <p className="text-muted mt-1 text-sm">
          All your orders and their current status.
        </p>
      </div>

      {/* Jobs table with search + filter */}
      <JobsTable jobs={MOCK_JOBS} showControls />
    </ClientDashboardLayout>
  );
}
