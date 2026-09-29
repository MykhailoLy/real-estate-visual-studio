import type { ReactNode } from "react";
import { headers } from "next/headers";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import {
  getDashboardRequestProfile,
  getDashboardRequestUser,
} from "@/lib/dashboard-request-context";
import {
  DASHBOARD_REQUEST_PATH_HEADER,
  safeDashboardRequestPath,
} from "@/lib/dashboard-request-path";
import { isProfileComplete } from "@/lib/profile-completion";

export default async function OrderingLayout({ children }: { children: ReactNode }) {
  const [user, profile, requestHeaders] = await Promise.all([
    getDashboardRequestUser(),
    getDashboardRequestProfile(),
    headers(),
  ]);

  const destination = safeDashboardRequestPath(
    requestHeaders.get(DASHBOARD_REQUEST_PATH_HEADER),
  );
  // Entering this route group mounts a new layout even when the catalogue's
  // shared layout is reused during client-side navigation. Keep the profile
  // gate here so concrete order forms cannot inherit the catalogue's access.
  if (!user || user.isQaPreview || isProfileComplete(profile)) {
    return children;
  }

  return (
    <ClientDashboardLayout>
      <div className="mx-auto max-w-2xl py-4 sm:py-8">
        <p className="mb-1.5 text-dashboard-kicker font-bold uppercase text-secondary-dark">
          Client Portal
        </p>
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold leading-tight text-primary sm:text-[28px]">
            Add contact details to place this order
          </h1>
          <p className="mt-3 text-dashboard-body leading-relaxed text-muted md:text-base">
            You can use the dashboard without completing your profile. Before
            an order can be submitted, we only need your name and phone number
            for the order record and delivery communication.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ClientPortalLink
              href={`/dashboard/profile?onboarding=1&next=${encodeURIComponent(destination)}`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-dashboard-action font-bold text-white shadow-sm transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Complete profile
            </ClientPortalLink>
            <ClientPortalLink
              href="/dashboard"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-white px-5 py-2.5 text-dashboard-action font-bold text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Back to dashboard
            </ClientPortalLink>
          </div>
        </div>
      </div>
    </ClientDashboardLayout>
  );
}
