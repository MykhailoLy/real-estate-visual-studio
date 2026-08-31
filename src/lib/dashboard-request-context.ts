import "server-only";

import { cache } from "react";
import { getClientUser } from "@/lib/client-auth";
import { getClientProfile } from "@/lib/client-profile";
import {
  resolveDashboardRequestProfile,
  resolveDashboardRequestUser,
} from "@/lib/client-portal-qa";

/**
 * React-render scoped only: never persists identity between requests. A real
 * Supabase session is always resolved before the non-production QA fallback.
 */
export const getDashboardRequestUser = cache(async () => {
  const verifiedUser = await getClientUser();
  return resolveDashboardRequestUser(verifiedUser);
});

/**
 * React-render scoped only: shares the dashboard profile read per request.
 * Synthetic QA renders use an in-memory complete profile and never query or
 * create a profile row.
 */
export const getDashboardRequestProfile = cache(async () => {
  const user = await getDashboardRequestUser();
  if (user?.isQaPreview) {
    return resolveDashboardRequestProfile(user, null);
  }

  const verifiedProfile = user ? await getClientProfile() : null;
  return resolveDashboardRequestProfile(user, verifiedProfile);
});
