import { permanentRedirect } from "next/navigation";

// /order/image-enhancement → /dashboard/orders/new/image-enhancement (308).
// Backward-compatible entry point for public CTA links. The order form is
// never rendered here; guests are routed to login by the /dashboard proxy,
// preserving this destination.
export default function ImageEnhancementOrderRedirect(): never {
  permanentRedirect("/dashboard/orders/new/image-enhancement");
}
