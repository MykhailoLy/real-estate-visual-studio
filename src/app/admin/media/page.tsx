import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";
import {
  getAllSiteMediaForAdmin,
  getSiteMediaPublicUrl,
  type SiteMediaItem,
} from "@/lib/site-media";
import MediaAdminClient, { type AdminMediaView } from "./MediaAdminClient";

// ============================================================
// /admin/media
//
// Server component. Loads every site_media_items row (admin
// sees drafts AND published items) and passes them, with public
// image URLs already resolved, into the client editor.
//
// Mirrors the architecture of /admin/portfolio:
//   - public URLs are resolved server-side because that's where
//     NEXT_PUBLIC_SUPABASE_URL is most reliably available
//   - force-dynamic so revalidatePath after CRUD always picks
//     up fresh data
//   - the page is small and only the admin hits it, so caching
//     brings no practical benefit here
// ============================================================

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Site Media Admin",
  // Never index admin surfaces.
  robots: { index: false, follow: false },
};

function publicUrlFor(path: string | null): string | null {
  return path ? getSiteMediaPublicUrl(path) : null;
}

function toView(row: SiteMediaItem): AdminMediaView {
  return {
    id: row.id,
    section: row.section,
    media_type: row.media_type,
    title: row.title,
    description: row.description,
    service_slug: row.service_slug,
    alt_text: row.alt_text,
    before_image_path: row.before_image_path,
    after_image_path: row.after_image_path,
    image_path: row.image_path,
    poster_image_path: row.poster_image_path,
    panorama_image_path: row.panorama_image_path,
    embed_url: row.embed_url,
    sort_order: row.sort_order,
    published: row.published,
    created_at: row.created_at,
    updated_at: row.updated_at,
    before_url: publicUrlFor(row.before_image_path),
    after_url: publicUrlFor(row.after_image_path),
    image_url: publicUrlFor(row.image_path),
    poster_url: publicUrlFor(row.poster_image_path),
    panorama_url: publicUrlFor(row.panorama_image_path),
  };
}

export default async function AdminMediaPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  // If ADMIN_PASSWORD is set but Supabase isn't, the client
  // component renders a helpful banner rather than a stack trace.
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const rawItems = supabaseConfigured ? await getAllSiteMediaForAdmin() : [];
  const items = rawItems.map(toView);

  return (
    <MediaAdminClient
      items={items}
      adminConfigured={isAdminConfigured()}
      supabaseConfigured={supabaseConfigured}
    />
  );
}
