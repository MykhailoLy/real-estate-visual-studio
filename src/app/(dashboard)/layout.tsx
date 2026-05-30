// Route-group layout for the client dashboard.
// Server component — reads the current user from the Supabase session
// cookie and injects it via DashboardUserProvider (React context) so
// any client component in the subtree (TopNav, MobileNav, etc.) can
// read it without every page having to pass it as a prop.
//
// Pages continue to render ClientDashboardLayout themselves so that
// pages like /dashboard/jobs can pass their own statusFilter state.

import { getClientUser } from "@/lib/client-auth";
import { DashboardUserProvider } from "@/components/dashboard/DashboardUserContext";
import type { DashboardUser } from "@/components/dashboard/DashboardUserContext";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const rawUser = await getClientUser();

  const user: DashboardUser | null = rawUser
    ? {
        email: rawUser.email,
        displayName: rawUser.displayName,
        firstName: rawUser.firstName,
      }
    : null;

  return (
    <DashboardUserProvider user={user}>
      {children}
    </DashboardUserProvider>
  );
}
