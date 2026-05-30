"use client";

// ============================================================
// AdminOrderStatusControl
//
// Inline status selector for a single order row in the admin
// orders table. POSTs to /api/admin/orders/[orderId]/status
// and shows loading / success / error feedback in-place.
//
// Does NOT update any other fields — status only.
// After a successful save, calls onUpdated(newStatus) so the
// parent can refresh its local state without a full page reload.
// ============================================================

import { useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";

const VALID_STATUSES = [
  "pending",
  "confirmed",
  "in-progress",
  "delivered",
  "cancelled",
] as const;

type OrderStatus = (typeof VALID_STATUSES)[number];

const STATUS_LABELS: Record<OrderStatus, string> = {
  "pending":     "Pending",
  "confirmed":   "Confirmed",
  "in-progress": "In Progress",
  "delivered":   "Delivered",
  "cancelled":   "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  "pending":     "text-amber-700 bg-amber-50 border-amber-200",
  "confirmed":   "text-blue-700 bg-blue-50 border-blue-200",
  "in-progress": "text-blue-700 bg-blue-50 border-blue-200",
  "delivered":   "text-emerald-700 bg-emerald-50 border-emerald-200",
  "cancelled":   "text-slate-500 bg-slate-100 border-slate-200",
};

interface Props {
  orderId: string;
  currentStatus: OrderStatus;
  /** Called with the new status string after a successful save. */
  onUpdated: (newStatus: OrderStatus) => void;
}

export default function AdminOrderStatusControl({
  orderId,
  currentStatus,
  onUpdated,
}: Props) {
  const [selected, setSelected]   = useState<OrderStatus>(currentStatus);
  const [loading, setLoading]     = useState(false);
  const [saved, setSaved]         = useState(false);   // brief checkmark flash
  const [error, setError]         = useState<string | null>(null);

  const isDirty = selected !== currentStatus;

  async function handleSave() {
    if (!isDirty || loading) return;
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status: selected }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? "Could not update status.");
        setSelected(currentStatus); // revert selector on error
        return;
      }

      // Flash a brief success indicator then let parent refresh
      setSaved(true);
      onUpdated(selected);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Network error. Please try again.");
      setSelected(currentStatus);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {/* Status selector */}
        <select
          value={selected}
          disabled={loading}
          onChange={(e) => {
            setSelected(e.target.value as OrderStatus);
            setError(null);
            setSaved(false);
          }}
          className={[
            "px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold",
            "focus:outline-none focus:ring-2 focus:ring-primary/25",
            "disabled:opacity-60 cursor-pointer transition-colors",
            STATUS_COLORS[selected],
          ].join(" ")}
          aria-label="Order status"
        >
          {VALID_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        {/* Save button — only visible when selection differs from DB value */}
        {isDirty && !loading && (
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary-light transition-colors shadow-sm"
          >
            Save
          </button>
        )}

        {/* Loading spinner */}
        {loading && (
          <Loader2
            className="w-4 h-4 animate-spin text-primary flex-shrink-0"
            aria-hidden
          />
        )}

        {/* Brief success tick */}
        {saved && !loading && (
          <Check
            className="w-4 h-4 text-emerald-600 flex-shrink-0"
            aria-hidden
          />
        )}
      </div>

      {/* Inline error */}
      {error && (
        <p className="flex items-center gap-1 text-[11px] text-red-600">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
