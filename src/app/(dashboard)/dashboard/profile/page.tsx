import { getClientUser } from "@/lib/client-auth";
import { getClientProfile } from "@/lib/client-profile";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import ClientProfileForm from "@/components/dashboard/ClientProfileForm";

export const metadata = {
  title: "Profile | PicchuSpot Client Portal",
};

interface ProfilePageProps {
  searchParams: Promise<{ onboarding?: string }>;
}

export default async function DashboardProfilePage({ searchParams }: ProfilePageProps) {
  const { onboarding } = await searchParams;
  const isOnboarding = onboarding === "1";

  const [user, profile] = await Promise.all([
    getClientUser(),
    getClientProfile(),
  ]);

  const authEmail = user?.email ?? "";

  // user.displayName is: user_metadata.full_name if set, otherwise email-prefix.
  // Only pass it as authFullName when it looks like a real name (contains a space
  // or doesn't match the email-prefix), so we don't pre-fill "jane" from "jane@…".
  const rawDisplayName = user?.displayName ?? "";
  const emailPrefix = authEmail.split("@")[0];
  const metaFullName =
    rawDisplayName && rawDisplayName !== emailPrefix ? rawDisplayName : null;

  return (
    <ClientDashboardLayout>
      {/* Page header */}
      <div className="mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark mb-1.5">
          Client Portal
        </p>
        <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
          {isOnboarding ? "Complete your client profile" : "Profile"}
        </h1>
        <p className="text-muted mt-1 text-sm">
          {isOnboarding
            ? "Tell us a bit about yourself to get started."
            : "Manage your account details and preferences."}
        </p>
      </div>

      <div className="max-w-2xl">
        <ClientProfileForm
          initialProfile={profile}
          authFullName={metaFullName}
          authEmail={authEmail}
          isOnboarding={isOnboarding}
        />
      </div>
    </ClientDashboardLayout>
  );
}
