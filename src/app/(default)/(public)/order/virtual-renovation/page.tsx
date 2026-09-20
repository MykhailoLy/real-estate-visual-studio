import { permanentRedirect } from "next/navigation";

// /order/virtual-renovation → /dashboard/orders/new/virtual-renovation (308).
// Backward-compatible entry point for existing public CTA links and
// bookmarks. The old public form is never rendered; guests are then
// routed to login by the /dashboard proxy, preserving this destination.
export default function VirtualRenovationOrderRedirect(): never {
  permanentRedirect("/dashboard/orders/new/virtual-renovation");
}
