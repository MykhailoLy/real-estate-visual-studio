import { permanentRedirect } from "next/navigation";

// /order/image-enhancement/single-exposure
//   → /dashboard/orders/new/image-enhancement/single-exposure  (308)
// Backward-compatible public entry point. The order form is never
// rendered here; guests are routed to login by the /dashboard proxy,
// preserving this destination.
export default function SingleExposureOrderRedirect(): never {
  permanentRedirect(
    "/dashboard/orders/new/image-enhancement/single-exposure"
  );
}
