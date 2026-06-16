import { permanentRedirect } from "next/navigation";

// /order/image-enhancement/hdr-bracketed
//   → /dashboard/orders/new/image-enhancement/hdr-bracketed  (308)
// Backward-compatible public entry point. No order form / upload is
// ever rendered here; guests are routed to login by the /dashboard
// proxy, preserving this destination.
export default function HdrBracketedOrderRedirect(): never {
  permanentRedirect(
    "/dashboard/orders/new/image-enhancement/hdr-bracketed"
  );
}
