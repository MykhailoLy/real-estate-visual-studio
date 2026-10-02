import {
  getDashboardRequestProfile,
  getDashboardRequestUser,
} from "@/lib/dashboard-request-context";
import { isProfileComplete } from "@/lib/profile-completion";
import { safeInternalPath } from "@/lib/safe-redirect";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import ClientProfileForm from "@/components/dashboard/ClientProfileForm";
import DeleteAccountControl from "@/components/dashboard/DeleteAccountControl";
import ClientAccountSecurity from "@/components/dashboard/ClientAccountSecurity";
import { getTurnstileSiteKeyFromEnv } from "@/components/auth/turnstile";

export const metadata = {
  title: "Profile | PicchuSpot Client Portal",
};

interface ProfilePageProps {
  searchParams: Promise<{ onboarding?: string; next?: string }>;
}

export default async function DashboardProfilePage({ searchParams }: ProfilePageProps) {
  const { onboarding, next } = await searchParams;
  // Where to send the client after completing their profile (e.g. back to
  // the selected order form). Sanitized to an internal path.
  const nextPath = next ? safeInternalPath(next) : null;

  const [user, profile] = await Promise.all([
    getDashboardRequestUser(),
    getDashboardRequestProfile(),
  ]);

  // An existing but incomplete historical row is still onboarding. This keeps
  // the profile screen aligned with the order boundary instead of relying on
  // row existence alone.
  const isOnboarding = onboarding === "1" || !isProfileComplete(profile);
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
        <p className="text-dashboard-kicker font-bold uppercase text-secondary-dark mb-1.5">
          Client Portal
        </p>
        <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
          {isOnboarding ? "Complete your client profile" : "Profile"}
        </h1>
        <p className="text-dashboard-body text-muted mt-1 md:text-base">
          {isOnboarding
            ? "Browse with an optional profile. Only your name is required to place an order."
            : "Manage your account details and preferences."}
        </p>
      </div>

      <div className="max-w-2xl">
        <ClientProfileForm
          initialProfile={profile}
          authFullName={metaFullName}
          authEmail={authEmail}
          isOnboarding={isOnboarding}
          nextPath={nextPath}
        />
        {user && !user.isQaPreview && <ClientAccountSecurity
          authEmail={authEmail}
          authUserId={user.id}
          turnstileSiteKey={getTurnstileSiteKeyFromEnv()}
        />}
        {user && !user.isQaPreview && <DeleteAccountControl email={authEmail} />}
      </div>
    </ClientDashboardLayout>
  );
}
