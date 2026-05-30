// ============================================================
// /dashboard/jobs — server component wrapper
//
// Fetches real orders for the authenticated user server-side,
// then passes them to ClientJobsShell which owns the filter state.
//
// Security: email is read from the validated Supabase SSR session
// via getClientUser() — NEVER from URL params or client input.
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
  // Read authenticated user from SSR session cookie (validated server-side)
  const user = await getClientUser();

  // Fetch real orders.  Email comes exclusively from the verified session —
  // never from the client.  Returns [] if env vars are absent or on error.
  const rawOrders = user?.email
    ? await getOrdersByClientEmail(user.email)
    : [];

  const jobs = mapOrdersToDashboardJobs(rawOrders);

  return <ClientJobsShell jobs={jobs} />;
}
