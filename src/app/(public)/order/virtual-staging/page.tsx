import { permanentRedirect } from "next/navigation";

// /order/virtual-staging → /dashboard/orders/new/virtual-staging (308).
// Backward-compatible entry point for existing public CTA links and
// bookmarks. The old public form is never rendered; guests are then
// routed to login by the /dashboard proxy, preserving this destination.
export default function VirtualStagingOrderRedirect(): never {
  permanentRedirect("/dashboard/orders/new/virtual-staging");
}
