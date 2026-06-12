import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";
import { getAllItemsForAdmin, getPortfolioPublicUrl } from "@/lib/portfolio";
import PortfolioAdminClient, {
  type AdminItemView,
} from "./PortfolioAdminClient";

// ============================================================
// /admin/portfolio
//
// Server component. Loads every portfolio_items row (admin sees
// drafts AND published items) and passes them, with their public
// image URLs already resolved, into the client editor.
//
// We compute the public URLs server-side because that's where
// NEXT_PUBLIC_SUPABASE_URL is most reliably available (build-time
// envs don't always make it into a client bundle in sandbox
// builds without secrets).
//
// `force-dynamic` so admin actions (revalidatePath after CRUD)
// always pick up fresh data. The page is small and only the admin
// hits it, so caching brings no practical benefit here.
// ============================================================

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Portfolio Admin",
  // Never index admin surfaces.
  robots: { index: false, follow: false },
};

export default async function AdminPortfolioPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  // If ADMIN_PASSWORD is set but Supabase isn't, we render a
  // helpful message rather than a stack trace.
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const rawItems = supabaseConfigured ? await getAllItemsForAdmin() : [];

  // Annotate each row with the resolved public URLs so the client
  // doesn't need access to NEXT_PUBLIC_SUPABASE_URL itself.
  const items: AdminItemView[] = rawItems.map((row) => ({
    id: row.id,
    service_slug: row.service_slug,
    title: row.title,
    description: row.description,
    before_image_path: row.before_image_path,
    after_image_path: row.after_image_path,
    before_alt: row.before_alt,
    after_alt: row.after_alt,
    gallery_filter: row.gallery_filter,
    sort_order: row.sort_order,
    featured_home: row.featured_home,
    published: row.published,
    created_at: row.created_at,
    updated_at: row.updated_at,
    before_url: getPortfolioPublicUrl(row.before_image_path),
    after_url: getPortfolioPublicUrl(row.after_image_path),
  }));

  return (
    <PortfolioAdminClient
      items={items}
      adminConfigured={isAdminConfigured()}
      supabaseConfigured={supabaseConfigured}
    />
  );
}
