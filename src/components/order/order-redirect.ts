"use client";

import { safeInternalPath } from "@/lib/safe-redirect";
import type { OrderSubmitResult } from "@/lib/submit-order";

// ============================================================
// Shared handling for auth/profile errors returned by submitOrder.
//
// The order forms live inside /dashboard (protected by the proxy),
// but a session can still expire mid-session, or a profile can be
// incomplete. In those cases we route the client to the right place
// while preserving the exact order route to return to afterwards.
// ============================================================

/**
 * If `result` is an auth or profile-completion error, navigate the
 * client to the right destination (preserving `orderRoute`) and return
 * true. Otherwise return false so the caller shows an inline error.
 */
export function redirectOnOrderAuthError(
  result: OrderSubmitResult,
  orderRoute: string,
): boolean {
  const route = safeInternalPath(orderRoute, "/dashboard/orders/new");

  if (result.errorCode === "unauthorized") {
    window.location.href = `/login?redirectTo=${encodeURIComponent(route)}`;
    return true;
  }

  if (result.errorCode === "profile-incomplete") {
    window.location.href = `/dashboard/profile?onboarding=1&next=${encodeURIComponent(
      route,
    )}`;
    return true;
  }

  return false;
}
