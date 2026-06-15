// ============================================================
// /dashboard/jobs — server component wrapper
//
// Fetches real orders for the authenticated user server-side,
// then hands them to ClientJobsShell which owns filter state.
//
// Security: email is read exclusively from the validated
// Supabase SSR session via getClientUser() — never from URL
// params, query strings, cookies, or any client input.
// ============================================================

import { getClientUser } from "@/lib/client-auth";
import {
  getOrdersForClient,
  mapOrdersToDashboardJobs,
} from "@/lib/client-orders";
import { getReviewsForClient } from "@/lib/client-reviews";
import { toOrderOwnership } from "@/lib/order-ownership";
import ClientJobsShell from "@/components/dashboard/ClientJobsShell";

export const metadata = {
  title: "Jobs | PicchuSpot Client Portal",
};

export default async function DashboardJobsPage() {
  // Validate session server-side — identity never comes from the client
  const user = await getClientUser();

  // Fetch real orders. Ownership comes exclusively from the verified
  // session. Returns [] when SUPABASE_SERVICE_ROLE_KEY is absent or on
  // any error, so the page degrades gracefully to the empty state.
  const [rawOrders, reviews] = user
    ? await Promise.all([
        getOrdersForClient(toOrderOwnership(user)),
        getReviewsForClient(toOrderOwnership(user)),
      ])
    : [[], []];

  const jobs = mapOrdersToDashboardJobs(rawOrders, reviews);

  return <ClientJobsShell jobs={jobs} />;
}
