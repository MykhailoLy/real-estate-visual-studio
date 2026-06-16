"use client";

// ============================================================
// AdminOrdersClient
//
// Client component for /admin/orders. Receives a snapshot of
// all orders from the server component, then manages local
// status state so inline updates reflect immediately without
// a full page reload.
//
// Architecture mirrors PortfolioAdminClient and MediaAdminClient:
//   - Server page fetches data, guards auth, passes as props
//   - This client component owns interactive state (filter, sort,
//     per-row status updates via AdminOrderStatusControl)
//   - router.refresh() is called after any status update so the
//     server snapshot stays in sync on the next load
// ============================================================

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  ArrowUpDown,
  Info,
} from "lucide-react";
import Link from "next/link";
import AdminOrderStatusControl from "@/components/admin/AdminOrderStatusControl";
import { formatDateTime } from "@/lib/display/file-format";
import { getOrderStatusLabel } from "@/lib/display/status-labels";
import { formatUSD } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────

type OrderStatus = "pending" | "confirmed" | "in-progress" | "delivered" | "cancelled";

export interface AdminOrderRow {
  id: string;
  order_number: string;
  service_type: string;
  service_label: string;
  status: OrderStatus;
  client_name: string;
  client_email: string;
  client_company: string | null;
  item_count: number;
  estimated_total_cents: number;
  job_title: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  orders: AdminOrderRow[];
  supabaseConfigured: boolean;
  totalCount: number;
  adminConfigured: boolean;
}

// ── Helpers ────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS: Array<{ value: OrderStatus | "all"; label: string }> = [
  { value: "all",          label: "All statuses" },
  { value: "pending",      label: "Pending" },
  { value: "confirmed",    label: "Confirmed" },
  { value: "in-progress",  label: "In Progress" },
  { value: "delivered",    label: "Delivered" },
  { value: "cancelled",    label: "Cancelled" },
];

function formatDate(iso: string): string {
  return formatDateTime(iso);
}

// ── Component ─────────────────────────────────────────────────

export default function AdminOrdersClient({
  orders: initialOrders,
  supabaseConfigured,
  totalCount,
  // adminConfigured accepted from server component; not used in UI yet
}: Props) {
  const router = useRouter();

  // Local order state so status changes reflect immediately in-row
  const [orders, setOrders] = useState<AdminOrderRow[]>(initialOrders);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [sortNewest, setSortNewest] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Apply filter + sort to local state
  const displayed = useMemo(() => {
    let rows = [...orders];
    if (statusFilter !== "all") {
      rows = rows.filter((o) => o.status === statusFilter);
    }
    rows.sort((a, b) => {
      const diff =
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortNewest ? diff : -diff;
    });
    return rows;
  }, [orders, statusFilter, sortNewest]);

  // Called by AdminOrderStatusControl after a successful save
  function handleStatusUpdated(orderId: string, newStatus: OrderStatus) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status: newStatus } : o
      )
    );
    // Refresh the server snapshot in the background so a page
    // reload picks up the new value without a visible flash
    router.refresh();
  }

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    // Stop spinner after a short delay — refresh() doesn't return a promise
    setTimeout(() => setRefreshing(false), 800);
  }

  return (
    <div>

        {/* ── Header ── */}

        {/* ── Supabase not-configured banner ── */}
        {!supabaseConfigured && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm leading-relaxed flex items-start gap-3">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden />
            <div>
              Supabase is not fully configured.{" "}
              <code className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="font-mono text-[12px]">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              must be set. Order list is empty and status updates will fail.
            </div>
          </div>
        )}

        {/* ── Status-update info note ── */}
        <div className="mb-5 rounded-xl border border-blue-200/60 bg-blue-50 px-4 py-3 text-[12px] text-blue-800 leading-relaxed flex items-start gap-2.5">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden />
          <p>
            Changing an order&apos;s status here updates the <code className="font-mono bg-blue-100 px-1 rounded">orders.status</code> column.
            The client dashboard reads this field directly, so the change is reflected
            the next time the client loads their jobs or order detail page.
          </p>
        </div>

        {/* ── Toolbar: filter + sort + count ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="status-filter"
              className="text-xs font-semibold tracking-[0.15em] uppercase text-muted"
            >
              Filter
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as OrderStatus | "all")
              }
              className="px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setSortNewest((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-white text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5" aria-hidden />
              {sortNewest ? "Newest first" : "Oldest first"}
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-white text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                aria-hidden
              />
              Refresh
            </button>
          </div>
          <p className="text-xs text-muted">
            {displayed.length} of {totalCount} order{totalCount !== 1 ? "s" : ""}
            {statusFilter !== "all" && (
              <span className="ml-1">
                · filtered by{" "}
                <strong>{getOrderStatusLabel(statusFilter)}</strong>
              </span>
            )}
          </p>
        </div>

        {/* ── Orders table ── */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
          {displayed.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted">
              {totalCount === 0
                ? "No orders have been submitted yet."
                : "No orders match the current filter."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full text-sm"
                style={{ minWidth: "860px" }}
              >
                <thead>
                  <tr className="bg-surface border-b border-border">
                    {[
                      "Order",
                      "Client",
                      "Service",
                      "Items / Cost",
                      "Status",
                      "Submitted",
                      "Deliverables",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayed.map((order) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      onStatusUpdated={(newStatus) =>
                        handleStatusUpdated(order.id, newStatus)
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

    </div>
  );
}

// ── OrderRow ───────────────────────────────────────────────────

function OrderRow({
  order,
  onStatusUpdated,
}: {
  order: AdminOrderRow;
  onStatusUpdated: (newStatus: OrderStatus) => void;
}) {
  return (
    <tr className="hover:bg-surface/50 transition-colors group">
      {/* Order number */}
      <td className="px-4 py-4 whitespace-nowrap">
        {order.job_title && (
          <p className="text-[13px] font-bold text-foreground leading-snug max-w-[220px] truncate">
            {order.job_title}
          </p>
        )}
        <p className="font-mono text-[12px] font-bold text-foreground group-hover:text-primary transition-colors">
          {order.order_number}
        </p>
        <p className="text-[10px] text-muted mt-0.5 font-mono">
          {order.id.slice(0, 8).toUpperCase()}
        </p>
      </td>

      {/* Client info */}
      <td className="px-4 py-4">
        <p className="text-[13px] font-semibold text-foreground leading-snug">
          {order.client_name}
        </p>
        <p className="text-[11px] text-muted truncate max-w-[180px]">
          {order.client_email}
        </p>
        {order.client_company && (
          <p className="text-[11px] text-muted-light truncate max-w-[180px]">
            {order.client_company}
          </p>
        )}
      </td>

      {/* Service */}
      <td className="px-4 py-4 whitespace-nowrap">
        <span className="text-[12px] text-foreground/80">
          {order.service_label}
        </span>
      </td>

      {/* Items / Cost */}
      <td className="px-4 py-4 whitespace-nowrap">
        <p className="text-[13px] font-semibold text-foreground tabular-nums">
          {formatUSD(order.estimated_total_cents)}
        </p>
        <p className="text-[11px] text-muted">
          {order.item_count} image{order.item_count !== 1 ? "s" : ""}
        </p>
      </td>

      {/* Status — inline control */}
      <td className="px-4 py-4 whitespace-nowrap">
        <AdminOrderStatusControl
          orderId={order.id}
          currentStatus={order.status}
          onUpdated={onStatusUpdated}
        />
      </td>

      {/* Submitted date */}
      <td className="px-4 py-4 whitespace-nowrap">
        <p className="text-[12px] text-foreground/70">
          {formatDate(order.created_at)}
        </p>
      </td>

      {/* Deliverables link */}
      <td className="px-4 py-4 whitespace-nowrap">
        <Link
          href={`/admin/orders/${order.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[11px] font-semibold text-foreground/70 hover:border-primary hover:text-primary bg-white transition-colors"
        >
          Files →
        </Link>
      </td>
    </tr>
  );
}
