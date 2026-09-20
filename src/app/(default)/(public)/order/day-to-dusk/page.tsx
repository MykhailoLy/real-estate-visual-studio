import { permanentRedirect } from "next/navigation";

// /order/day-to-dusk → /dashboard/orders/new/day-to-dusk (308).
// Backward-compatible entry point for public CTA links. The order form is
// never rendered here; guests are routed to login by the /dashboard proxy,
// preserving this destination.
export default function DayToDuskOrderRedirect(): never {
  permanentRedirect("/dashboard/orders/new/day-to-dusk");
}
