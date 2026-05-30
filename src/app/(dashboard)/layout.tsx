// Route-group layout for the client dashboard.
// Server component — reads the current user from the Supabase session
// cookie and injects it via DashboardUserProvider (React context) so
// any client component in the subtree (TopNav, MobileNav, etc.) can
// read it without every page having to pass it as a prop.
//
// Also fetches the client_profiles row (if it exists) so the nav can
// show the profile first_name instead of the auth metadata name.
//
// Pages continue to render ClientDashboardLayout themselves so that
// pages like /dashboard/jobs can pass their own statusFilter state.

import { getClientUser } from "@/lib/client-auth";
import { getClientProfile } from "@/lib/client-profile";
import { DashboardUserProvider } from "@/components/dashboard/DashboardUserContext";
import type { DashboardUser } from "@/components/dashboard/DashboardUserContext";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const rawUser = await getClientUser();

  // Fetch profile in parallel-ish — only if we have a user
  const profile = rawUser ? await getClientProfile() : null;

  const user: DashboardUser | null = rawUser
    ? {
        email: rawUser.email,
        displayName: rawUser.displayName,
        firstName: rawUser.firstName,
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
      {children}
    </DashboardUserProvider>
  );
}
