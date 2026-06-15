import { permanentRedirect } from "next/navigation";

// ============================================================
// /portfolio  →  /gallery   (permanent 308 redirect)
//
// The public /portfolio page is obsolete. /gallery is now the
// primary public portfolio experience, so this route issues a
// permanent, server-side redirect. permanentRedirect() throws
// before any markup is produced, so the old Portfolio page is
// never rendered and search engines transfer ranking signals
// from /portfolio to /gallery.
//
// SCOPE: This ONLY affects the obsolete PUBLIC /portfolio route.
// The admin portfolio interface (/admin/portfolio), portfolio
// API routes, database tables, Supabase Storage objects, and all
// internal "portfolio" naming are intentionally left untouched.
// ============================================================

export default function PortfolioRedirectPage(): never {
  permanentRedirect("/gallery");
}
