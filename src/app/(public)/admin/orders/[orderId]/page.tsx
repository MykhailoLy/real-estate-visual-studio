import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
import AdminDeliverableUpload, {
  type DeliverableRow,
} from "@/components/admin/AdminDeliverableUpload";

// ============================================================
// /admin/orders/[orderId] — admin order detail + deliverables
//
// Server component.  Guards with isAdminAuthenticated(), then:
//  1. Fetches the order summary row.
//  2. Fetches existing order_deliverables for this order.
//  3. Renders a read-only summary + AdminDeliverableUpload.
//
// Pattern mirrors /admin/orders (force-dynamic, nodejs runtime,
// service-role DB access, auth guard before any data fetch).
// ============================================================

export const dynamic  = "force-dynamic";
export const runtime  = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderId: string }>;
}): Promise<Metadata> {
  const { orderId } = await params;
  return {
    title:  `Order ${orderId.slice(0, 8).toUpperCase()} — Admin | PicchuSpot`,
    robots: { index: false, follow: false },
  };
}

// ── Service slug → label (mirrors admin/orders page) ──────────

const SERVICE_LABELS: Record<string, string> = {
  "virtual-staging":        "Virtual Staging",
  "virtual-renovation":     "Virtual Renovation",
  "3d-floor-plans":         "Floor Plans",
  "photo-editing":          "Photo Editing",
  "image-enhancement":      "Image Enhancement",
  "day-to-dusk":            "Day to Dusk",
  "item-removal":           "Item Removal",
  "virtual-cleaning":       "Virtual Cleaning",
  "360-image-enhancement":  "360° Image Enhancement",
  "360-virtual-staging":    "360° Virtual Staging",
  "aerial-editing":         "Aerial Editing",
  "development-site-plans": "Development Site Plans",
};

function toLabel(slug: string): string {
  return SERVICE_LABELS[slug] ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

const STATUS_COLORS: Record<string, string> = {
  "pending":     "bg-amber-50 text-amber-700 border-amber-200",
  "confirmed":   "bg-blue-50 text-blue-700 border-blue-200",
  "in-progress": "bg-blue-50 text-blue-700 border-blue-200",
  "delivered":   "bg-emerald-50 text-emerald-700 border-emerald-200",
  "cancelled":   "bg-slate-100 text-slate-500 border-slate-200",
};

// ── Page ──────────────────────────────────────────────────────

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  // ── Auth guard ──────────────────────────────────────────
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  // ── Supabase ────────────────────────────────────────────
  type OrderRow = {
    id: string; order_number: string; service_type: string; status: string;
    client_name: string; client_email: string; client_company: string | null;
    item_count: number; estimated_total_cents: number;
    created_at: string; updated_at: string;
  };

  let order: OrderRow | null = null;
  let deliverables: DeliverableRow[] = [];
  let supabaseError: string | null = null;

  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (supabaseConfigured) {
    try {
      const supabase = createServerClient();

      // Fetch order
      const { data: orderData, error: orderErr } = await supabase
        .from("orders")
        .select(
          "id, order_number, service_type, status, " +
          "client_name, client_email, client_company, " +
          "item_count, estimated_total_cents, created_at, updated_at"
        )
        .eq("id", orderId)
        .maybeSingle();

      if (orderErr) {
        supabaseError = orderErr.message;
      } else {
        order = orderData as unknown as OrderRow | null;
      }

      // Fetch existing deliverables for this order
      if (order) {
        const { data: delivData, error: delivErr } = await supabase
          .from("order_deliverables")
          .select(
            "id, order_id, order_number, item_index, " +
            "filename, file_size, mime_type, uploaded_at"
          )
          .eq("order_id", orderId)
          .order("uploaded_at", { ascending: false });

        if (!delivErr) {
          deliverables = (delivData ?? []) as unknown as DeliverableRow[];
        }
      }
    } catch (err) {
      supabaseError = String(err);
    }
  }

  const formatUSD = (cents: number) =>
    `US$${(cents / 100).toFixed(2)}`;

  return (
    <section className="bg-surface min-h-screen py-10 lg:py-14">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10">

        {/* ── Header ── */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6 lg:mb-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-2">
              PicchuSpot Admin
            </p>
            <h1 className="text-3xl lg:text-4xl font-bold text-primary tracking-tight">
              Order Deliverables
            </h1>
            {order && (
              <p className="mt-1 text-sm text-muted font-mono">{order.order_number}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden />
              Back to orders
            </Link>
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <LogOut className="w-4 h-4" aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        </header>

        {/* ── Error / config banners ── */}
        {!supabaseConfigured && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
            Supabase is not configured. Set{" "}
            <code className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono text-[12px]">SUPABASE_SERVICE_ROLE_KEY</code>.
          </div>
        )}
        {supabaseError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
            DB error: {supabaseError}
          </div>
        )}
        {!order && supabaseConfigured && !supabaseError && (
          <div className="mb-6 rounded-xl border border-border bg-white px-4 py-3 text-sm text-muted">
            Order not found.
          </div>
        )}

        {order && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── Left: order summary ── */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border bg-surface/60">
                  <h2 className="text-[13px] font-bold text-foreground">Order summary</h2>
                </div>
                <dl className="divide-y divide-border">
                  {[
                    ["Order #",   order.order_number],
                    ["Service",   toLabel(order.service_type)],
                    ["Client",    order.client_name],
                    ["Email",     order.client_email],
                    ["Company",   order.client_company ?? "—"],
                    ["Images",    String(order.item_count)],
                    ["Est. total", formatUSD(order.estimated_total_cents)],
                    ["Submitted", formatDate(order.created_at)],
                    ["Updated",   formatDate(order.updated_at)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-3 px-5 py-3">
                      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light flex-shrink-0">
                        {label}
                      </dt>
                      <dd className="text-[12px] text-foreground text-right break-all">
                        {label === "Status" ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[value] ?? "bg-surface text-muted border-border"}`}
                          >
                            {value}
                          </span>
                        ) : value}
                      </dd>
                    </div>
                  ))}
                  {/* Status row separately for badge rendering */}
                  <div className="flex items-start justify-between gap-3 px-5 py-3">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light flex-shrink-0">
                      Status
                    </dt>
                    <dd>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[order.status] ?? "bg-surface text-muted border-border"}`}
                      >
                        {order.status}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* ── Right: deliverables upload ── */}
            <div className="lg:col-span-2">
              <AdminDeliverableUpload
                orderId={order.id}
                orderNumber={order.order_number}
                initialDeliverables={deliverables}
              />
            </div>

          </div>
        )}

      </div>
    </section>
  );
}
