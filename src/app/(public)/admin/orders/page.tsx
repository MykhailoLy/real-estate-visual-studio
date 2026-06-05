import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
import AdminOrdersClient, {
  type AdminOrderRow,
} from "./AdminOrdersClient";
import { getServiceLabel } from "@/lib/display/service-labels";

// ============================================================
// /admin/orders
//
// Server component. Guards with isAdminAuthenticated(), then
// fetches all orders (newest first) using the service role key
// and hands them to AdminOrdersClient as serialisable props.
//
// Pattern mirrors /admin/portfolio and /admin/media:
//   - force-dynamic so router.refresh() always picks up new data
//   - runtime="nodejs" for the crypto-based admin-auth cookie check
//   - data fetched server-side; never sent via client API calls
//
// Service label translation is done here so the client component
// has no dependency on the slug→label map.
// ============================================================

export const dynamic   = "force-dynamic";
export const runtime   = "nodejs";

export const metadata: Metadata = {
  title: "Orders Admin — PicchuSpot",
  robots: { index: false, follow: false },
};

// ── Service slug → human label ─────────────────────────────────
// Mirrors the map in client-orders.ts so both sides stay in sync.
// Kept here so the server component can annotate rows before
// passing them to the client.
function toServiceLabel(slug: string): string {
  return getServiceLabel(slug);
}

// ── Page ──────────────────────────────────────────────────────

export default async function AdminOrdersPage() {
  // ── Auth guard ────────────────────────────────────────────
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Fetch all orders (newest first) ──────────────────────
  let orders: AdminOrderRow[] = [];
  let totalCount = 0;

  if (supabaseConfigured) {
    try {
      const supabase = createServerClient();

      const { data, error, count } = await supabase
        .from("orders")
        .select(
          "id, order_number, service_type, status, " +
          "client_name, client_email, client_company, " +
          "item_count, estimated_total_cents, " +
          "created_at, updated_at",
          { count: "exact" }
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[admin/orders] Fetch error:", error.message);
      } else {
        totalCount = count ?? 0;
        orders = ((data ?? []) as unknown as Array<{
          id: string;
          order_number: string;
          service_type: string;
          status: string;
          client_name: string;
          client_email: string;
          client_company: string | null;
          item_count: number;
          estimated_total_cents: number;
          created_at: string;
          updated_at: string;
        }>).map((row) => ({
          id:                     row.id,
          order_number:           row.order_number,
          service_type:           row.service_type,
          service_label:          toServiceLabel(row.service_type),
          status:                 row.status as AdminOrderRow["status"],
          client_name:            row.client_name,
          client_email:           row.client_email,
          client_company:         row.client_company ?? null,
          item_count:             row.item_count,
          estimated_total_cents:  row.estimated_total_cents,
          created_at:             row.created_at,
          updated_at:             row.updated_at,
        }));
      }
    } catch (err) {
      console.error("[admin/orders] Supabase init error:", err);
    }
  }

  return (
    <AdminOrdersClient
      orders={orders}
      supabaseConfigured={supabaseConfigured}
      totalCount={totalCount}
      adminConfigured={isAdminConfigured()}
    />
  );
}
