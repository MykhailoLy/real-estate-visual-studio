import { permanentRedirect } from "next/navigation";

// /order/item-removal-virtual-cleaning →
//   /dashboard/orders/new/item-removal-virtual-cleaning (308).
// Backward-compatible entry point for public CTA links. The order form is
// never rendered here; guests are routed to login by the /dashboard proxy,
// preserving this destination.
export default function ItemRemovalOrderRedirect(): never {
  permanentRedirect("/dashboard/orders/new/item-removal-virtual-cleaning");
}
