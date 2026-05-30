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
  getOrdersByClientEmail,
  mapOrdersToDashboardJobs,
} from "@/lib/client-orders";
import ClientJobsShell from "@/components/dashboard/ClientJobsShell";

export const metadata = {
  title: "Jobs | PicchuSpot Client Portal",
};

export default async function DashboardJobsPage() {
  // Validate session server-side — email never comes from the client
  const user = await getClientUser();

  // Fetch real orders. Email comes exclusively from the verified session.
  // Returns [] when SUPABASE_SERVICE_ROLE_KEY is absent or on any error,
  // so the page degrades gracefully to the empty state.
  const rawOrders = user?.email
    ? await getOrdersByClientEmail(user.email)
    : [];

  const jobs = mapOrdersToDashboardJobs(rawOrders);

  return <ClientJobsShell jobs={jobs} />;
}
