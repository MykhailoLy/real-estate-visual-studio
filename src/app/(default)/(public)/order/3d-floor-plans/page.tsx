import { permanentRedirect } from "next/navigation";

// /order/3d-floor-plans → /dashboard/orders/new/3d-floor-plans (308).
// Backward-compatible entry point for existing public CTA links and
// bookmarks. The old public form is never rendered; guests are then
// routed to login by the /dashboard proxy, preserving this destination.
export default function FloorPlansOrderRedirect(): never {
  permanentRedirect("/dashboard/orders/new/3d-floor-plans");
}
