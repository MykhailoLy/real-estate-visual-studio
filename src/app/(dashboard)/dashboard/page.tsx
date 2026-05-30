import Link from "next/link";
import {
  Briefcase,
  Clock,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  ArrowRight,
} from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import DashboardStatCard from "@/components/dashboard/DashboardStatCard";
import JobsTable from "@/components/dashboard/JobsTable";
import { MOCK_JOBS, MOCK_CLIENT, getDashboardStats } from "@/lib/client-dashboard/mock-data";

export const metadata = {
  title: "Dashboard | PicchuSpot Client Portal",
};

export default function DashboardPage() {
  const stats = getDashboardStats(MOCK_JOBS);
  const recentJobs = [...MOCK_JOBS].sort(
    (a, b) =>
      new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime()
  );

  return (
    <ClientDashboardLayout>
      {/* Welcome block */}
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary-dark mb-1">
          Client Portal
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary leading-tight">
          Welcome back, {MOCK_CLIENT.firstName}
        </h1>
        <p className="text-muted mt-1 text-sm">
          Here&rsquo;s an overview of your PicchuSpot account.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <DashboardStatCard
          label="Active Jobs"
          value={stats.activeJobs}
          icon={Briefcase}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <DashboardStatCard
          label="Awaiting Submission"
          value={stats.awaitingSubmission}
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <DashboardStatCard
          label="Completed"
          value={stats.completedJobs}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <DashboardStatCard
          label="Revisions"
          value={stats.revisions}
          icon={RefreshCw}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
        />
      </div>

      {/* Recent jobs */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-foreground">Recent Jobs</h2>
          <Link
            href="/dashboard/jobs"
            className="text-sm font-semibold text-primary hover:text-primary-light transition-colors flex items-center gap-1"
          >
            View all
            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </Link>
        </div>
        <JobsTable jobs={recentJobs} limit={5} />
      </section>

      {/* CTA card */}
      <div className="bg-primary rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">
            Ready to place a new order?
          </h2>
          <p className="text-white/70 text-sm leading-relaxed">
            Virtual staging, floor plans, day-to-dusk, image enhancement, and
            more — delivered in 24–48 hours.
          </p>
        </div>
        <Link
          href="/order"
          className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-primary-dark font-bold rounded-lg hover:bg-secondary-light transition-colors text-sm whitespace-nowrap flex-shrink-0 shadow-sm"
        >
          <PlusCircle className="w-4 h-4" aria-hidden />
          Create a New Order
        </Link>
      </div>
    </ClientDashboardLayout>
  );
}
