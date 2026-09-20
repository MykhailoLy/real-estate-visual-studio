import { permanentRedirect } from "next/navigation";

// ============================================================
// /order  →  /dashboard/orders/new   (permanent 308 redirect)
//
// Ordering is now authenticated-only and lives inside the client
// dashboard. This route is kept ONLY as a backward-compatible entry
// point for existing public CTA links and bookmarks. permanentRedirect()
// throws before any markup is produced, so the old public order hub is
// never rendered. Unauthenticated visitors are then bounced by the
// /dashboard proxy to /login?redirectTo=/dashboard/orders/new.
// ============================================================

export default function OrderHubRedirect(): never {
  permanentRedirect("/dashboard/orders/new");
}
