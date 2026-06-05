"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RotateCcw, Clock, CheckCircle2, Loader2, AlertCircle, MessageSquare, Tag, ExternalLink, Upload, Paperclip,
} from "lucide-react";
import type { ReworkRow } from "@/app/(public)/admin/rework/page";
import { formatDateTime as formatDate, itemLabel } from "@/lib/display/file-format";
import { getReviewStatusLabel } from "@/lib/display/status-labels";

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  rework_requested: {
    label: getReviewStatusLabel("rework_requested"),
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <RotateCcw className="w-3 h-3" aria-hidden />,
  },
  rework_in_progress: {
    label: getReviewStatusLabel("rework_in_progress"),
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Clock className="w-3 h-3" aria-hidden />,
  },
};

interface Props {
  initialRows: ReworkRow[];
}

export default function AdminReworkList({ initialRows }: Props) {
  const [rows, setRows] = useState<ReworkRow[]>(initialRows);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function updateStatus(reviewId: string, newStatus: "rework_in_progress" | "resolved") {
    setLoadingId(reviewId);
    setErrorId(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ status: newStatus }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; status?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Update failed.");

      if (newStatus === "resolved") {
        // Remove from active list
        setRows((prev) => prev.filter((r) => r.id !== reviewId));
      } else {
        // Update status in place
        setRows((prev) => prev.map((r) =>
          r.id === reviewId ? { ...r, status: newStatus } : r
        ));
      }
    } catch (err) {
      setErrorId(reviewId);
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoadingId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl shadow-sm p-10 flex flex-col items-center text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-3" aria-hidden />
        <p className="text-sm font-semibold text-foreground">All caught up!</p>
        <p className="text-xs text-muted mt-1">No active rework requests.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex items-center gap-2">
        <RotateCcw className="w-4 h-4 text-primary" aria-hidden />
        <h2 className="text-[13px] font-bold text-foreground">
          Active rework requests
        </h2>
        <span className="ml-auto text-[11px] text-muted-light">
          {rows.length} active
        </span>
      </div>

      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const badge = STATUS_BADGE[r.status];
          const isLoading = loadingId === r.id;
          return (
            <li key={r.id} className="px-5 py-4 space-y-2">
              {/* Top: order info + status */}
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Link
                  href={`/admin/orders/${r.order_id}`}
                  className="inline-flex min-w-0 items-center gap-1 text-[12px] font-semibold text-primary hover:text-primary-light transition-colors"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" aria-hidden />
                  <span className="truncate">{r.order_number}</span>
                </Link>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary bg-primary/8 border border-primary/15 px-1.5 py-0.5 rounded-full">
                  <Tag className="w-2.5 h-2.5" aria-hidden />
                  {itemLabel(r.item_index)}
                </span>
                {r.filename && (
                  <span
                    className="max-w-[220px] truncate text-[11px] text-muted"
                    title={r.filename}
                  >
                    {r.filename}
                  </span>
                )}
                {r.reference_file_count > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                    <Paperclip className="h-2.5 w-2.5" aria-hidden />
                    {r.reference_file_count} reference file
                    {r.reference_file_count !== 1 ? "s" : ""}
                  </span>
                )}
                {badge && (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold border rounded-full px-2 py-0.5 ${badge.cls}`}>
                    {badge.icon}{badge.label}
                  </span>
                )}
              </div>

              {/* Comment */}
              {r.comment && (
                <p className="text-[12px] text-foreground/80 bg-surface border border-border rounded-lg px-3 py-2 leading-relaxed">
                  <MessageSquare className="inline w-3 h-3 mr-1 -mt-px text-muted" aria-hidden />
                  {r.comment}
                </p>
              )}

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                <span className="max-w-full truncate">{r.client_email}</span>
                <span>{formatDate(r.created_at)}</span>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Link
                  href={`/admin/orders/${r.order_id}?reviewId=${r.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-[11px] font-semibold hover:bg-primary-light transition-colors shadow-sm"
                >
                  <Upload className="w-3 h-3" aria-hidden />
                  Upload replacement
                </Link>
                {r.status === "rework_requested" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(r.id, "rework_in_progress")}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[11px] font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
                  >
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : <Clock className="w-3 h-3" aria-hidden />}
                    Mark in progress
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => updateStatus(r.id, "resolved")}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60"
                >
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : <CheckCircle2 className="w-3 h-3" aria-hidden />}
                  Mark resolved
                </button>
              </div>

              {/* Error */}
              {errorId === r.id && errorMsg && (
                <p className="flex items-center gap-1 text-[11px] text-red-600 mt-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden />
                  {errorMsg}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
