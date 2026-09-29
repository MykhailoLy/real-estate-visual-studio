// ============================================================
// ORDER ACCESS GATE — server-side guard for dashboard order pages
//
// Centralises the authenticated client lookup used by order pages.
// The /dashboard proxy already enforces the session; we re-check it for
// defence-in-depth and to read the verified email.
//
// Profile completeness is deliberately NOT redirected from this helper.
// The shared new-order layout renders a stable contact-details gate for
// incomplete profiles, while /api/order remains the final fail-closed
// identity boundary.
//
// Server-only.
// ============================================================

import "server-only";
import { redirect } from "next/navigation";
import { getDashboardRequestUser } from "@/lib/dashboard-request-context";

export interface OrderingClient {
  /** Verified session ID used only by trusted server-side eligibility reads. */
  userId: string;
  /** Verified session email — passed to the form for the confirmation screen. */
  email: string;
}

/**
 * Ensure the current request is from an authenticated client. Redirects
 * to login otherwise and returns verified session identity on success.
 *
 * Profile completeness is handled by the shared new-order layout and is
 * revalidated by the order API before an order can be created.
 */
export async function requireOrderingClient(
  orderRoute: string,
): Promise<OrderingClient> {
  const user = await getDashboardRequestUser();
  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent(orderRoute)}`);
  }

  return { email: user.email, userId: user.id };
}
