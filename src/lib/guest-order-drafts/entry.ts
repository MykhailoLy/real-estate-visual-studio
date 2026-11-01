import { VIRTUAL_STAGING_DRAFT_ROUTE } from "../order-drafts/virtual-staging.ts";

export const GUEST_ENTRY = "/order/virtual-staging?configure=1";
export const GUEST_LOGIN = "/login?redirectTo=" + encodeURIComponent(GUEST_ENTRY);
export function guestDraftsEnabled() {
  return ["1", "true"].includes(process.env.GUEST_ORDER_DRAFTS_ENABLED ?? "");
}

// An old 308 for the bare public URL may already be cached by the browser.
export function guestEntryForDashboard(destination: string) {
  const [path, query] = destination.split("?");
  return guestDraftsEnabled() &&
    path === VIRTUAL_STAGING_DRAFT_ROUTE &&
    !new URLSearchParams(query).has("draft")
    ? GUEST_ENTRY
    : null;
}
