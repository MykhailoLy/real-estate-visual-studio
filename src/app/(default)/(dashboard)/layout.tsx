// Route-group layout for the client dashboard.
// Server component — reads the current user from the Supabase session
// cookie and injects it via DashboardUserProvider (React context) so
// any client component in the subtree (TopNav, MobileNav, etc.) can
// read it without every page having to pass it as a prop.
//
// Also fetches the client_profiles row (if it exists) so the nav can
// show the profile first_name instead of the auth metadata name.
//
// Pages continue to render ClientDashboardLayout themselves so local content
// can remain readable inside the shared wide client-workspace shell.

import type { Metadata } from "next";
import { guestEntryForDashboard } from "@/lib/guest-order-drafts/entry";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getDashboardRequestProfile,
  getDashboardRequestUser,
} from "@/lib/dashboard-request-context";
import {
  DASHBOARD_REQUEST_PATH_HEADER,
  safeDashboardRequestPath,
} from "@/lib/dashboard-request-path";
import DashboardDocumentScrollLock from "@/components/dashboard/DashboardDocumentScrollLock";
import { DashboardUserProvider } from "@/components/dashboard/DashboardUserContext";
import type { DashboardUser } from "@/components/dashboard/DashboardUserContext";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const preferredRegion = "dub1";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The verified user and RLS-scoped profile reads are independent. React
  // cache shares them with any page helper in this same server render only.
  const [rawUser, profile] = await Promise.all([
    getDashboardRequestUser(),
    getDashboardRequestProfile(),
  ]);

  const requestHeaders = await headers();
  const destination = safeDashboardRequestPath(
    requestHeaders.get(DASHBOARD_REQUEST_PATH_HEADER),
  );

  if (!rawUser) {
    const guestEntry = guestEntryForDashboard(destination);
    if (guestEntry) redirect(guestEntry);
    redirect(`/login?redirectTo=${encodeURIComponent(destination)}`);
  }

  // Profile completion is intentionally not a portal-wide gate. Clients can
  // browse the dashboard with an incomplete profile; order routes handle the
  // minimum contact-details requirement explicitly at the order boundary.

  const user: DashboardUser | null = rawUser
    ? {
        email: rawUser.email,
        displayName: rawUser.displayName,
        firstName: rawUser.firstName,
        avatarUrl: rawUser.avatarUrl,
        isQaPreview: rawUser.isQaPreview,
        // profileName: prefer profile first_name, fall back to full_name split, else null
        profileName:
          profile?.first_name?.trim() ||
          (profile?.full_name?.trim()
            ? profile.full_name.trim().split(" ")[0]
            : null) ||
          null,
      }
    : null;

  return (
    <DashboardUserProvider user={user}>
      <DashboardDocumentScrollLock />
      {children}
    </DashboardUserProvider>
  );
}
