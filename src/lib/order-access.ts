// ============================================================
// ORDER ACCESS GATE — server-side guard for dashboard order pages
//
// Centralises the "can this client open an order form?" decision so
// all four service pages behave identically:
//   1. Must have a verified Supabase session (the /dashboard proxy
//      already enforces this; we re-check for defence-in-depth and to
//      read the email).
//   2. Must have a complete client_profiles row (name + phone). If
//      not, we send them to profile onboarding, preserving the
//      intended order route in `next` so they return here afterwards.
//
// Server-only.
// ============================================================

import "server-only";
import { redirect } from "next/navigation";
import {
  getDashboardRequestProfile,
  getDashboardRequestUser,
} from "@/lib/dashboard-request-context";
import { isProfileComplete } from "@/lib/profile-completion";

export interface OrderingClient {
  /** Verified session ID used only by trusted server-side eligibility reads. */
  userId: string;
  /** Verified session email — passed to the form for the confirmation screen. */
  email: string;
}

/**
 * Ensure the current request is from an authenticated client with a
 * complete profile. Redirects (throws) otherwise. Returns the verified
 * email on success.
 */
export async function requireOrderingClient(
  orderRoute: string,
): Promise<OrderingClient> {
  const user = await getDashboardRequestUser();
  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent(orderRoute)}`);
  }

  const profile = await getDashboardRequestProfile();
  if (!isProfileComplete(profile)) {
    redirect(
      `/dashboard/profile?onboarding=1&next=${encodeURIComponent(orderRoute)}`,
    );
  }

  return { email: user.email, userId: user.id };
}
