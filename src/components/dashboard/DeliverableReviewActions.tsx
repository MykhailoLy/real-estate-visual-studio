"use client";

// ============================================================
// DeliverableReviewActions  (Phase 5D.1)
//
// Renders inline Approve / Request Rework controls for a single
// deliverable. State transitions:
//
//  pending_review   → Approve button + Request rework button
//  approved         → ✓ Approved badge  (terminal — no more actions)
//  rework_requested → ↩ Rework requested badge + comment preview
//  rework_in_progress → 🔄 In progress badge
//  rework_delivered → New version ready banner + Approve / Request rework
//  resolved         → ✓ Resolved badge  (terminal — no more actions)
//
// All state mutations go through:
//   POST /api/client/deliverables/[deliverableId]/review
//
// No storage paths are ever sent or received.
// ============================================================

import { useState } from "react";
import {
  CheckCircle2,
  RotateCcw,
  Loader2,
  AlertCircle,
  Clock,
  MessageSquare,
  X,
  Send,
  Sparkles,
} from "lucide-react";
import type { ReviewStatus } from "@/lib/client-reviews";

// ── Types ─────────────────────────────────────────────────────

interface Props {
  deliverableId: string;
  /** Latest review status for this deliverable. Null = no review yet. */
  initialReviewStatus: ReviewStatus | null;
  /** Latest review comment (shown as preview when rework_requested). */
  initialComment?: string | null;
  /** Optional filename for aria labels. */
  filename?: string;
}

// ── Status badge config ───────────────────────────────────────

type BadgeVariant = "green" | "amber" | "blue" | "purple";

const STATUS_BADGE: Record<
  ReviewStatus,
  { label: string; variant: BadgeVariant; icon: React.ReactNode } | null
> = {
  pending_review:    null, // no badge — show action buttons instead
  rework_delivered:  null, // no badge — show "new version ready" + action buttons
  approved: {
    label: "Approved",
    variant: "green",
    icon: <CheckCircle2 className="w-3 h-3" aria-hidden />,
  },
  rework_requested: {
    label: "Rework requested",
    variant: "amber",
    icon: <RotateCcw className="w-3 h-3" aria-hidden />,
  },
  rework_in_progress: {
    label: "In progress",
    variant: "blue",
    icon: <Clock className="w-3 h-3" aria-hidden />,
  },
  resolved: {
    label: "Resolved",
    variant: "green",
    icon: <CheckCircle2 className="w-3 h-3" aria-hidden />,
  },
};

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber:  "bg-amber-50  text-amber-700  border-amber-200",
  blue:   "bg-blue-50   text-blue-700   border-blue-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
};

// ── Component ─────────────────────────────────────────────────

export default function DeliverableReviewActions({
  deliverableId,
  initialReviewStatus,
  initialComment,
  filename,
}: Props) {
  const [status,    setStatus]    = useState<ReviewStatus | null>(initialReviewStatus ?? null);
  const [comment,   setComment]   = useState<string | null>(initialComment ?? null);
  const [showForm,  setShowForm]  = useState(false);
  const [draftText, setDraftText] = useState("");
  const [loading,   setLoading]   = useState<"approve" | "rework" | null>(null);
  const [apiError,  setApiError]  = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fileLabel = filename ? `"${filename}"` : "this file";

  // ── API call helper ───────────────────────────────────────

  async function postReview(
    action: "approve" | "rework_requested",
    reviewComment?: string
  ) {
    setApiError(null);
    setLoading(action === "approve" ? "approve" : "rework");

    try {
      const body =
        action === "approve"
          ? { action }
          : { action, comment: reviewComment };

      const res = await fetch(
        `/api/client/deliverables/${deliverableId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(body),
        }
      );

      const data = await res.json() as {
        ok?: boolean;
        error?: string;
        review?: { id: string; status: ReviewStatus; comment: string | null };
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Request failed.");
      }

      setStatus(data.review!.status);
      setComment(data.review!.comment ?? null);
      setShowForm(false);
      setDraftText("");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  // ── Approve handler ───────────────────────────────────────

  function handleApprove() {
    if (loading) return;
    postReview("approve");
  }

  // ── Rework form handlers ──────────────────────────────────

  function handleOpenForm() {
    setShowForm(true);
    setFormError(null);
    setDraftText("");
    setApiError(null);
  }

  function handleCancelForm() {
    setShowForm(false);
    setFormError(null);
    setDraftText("");
  }

  function handleSubmitRework() {
    const text = draftText.trim();
    if (text.length < 10) {
      setFormError("Please describe what needs to change (min 10 characters).");
      return;
    }
    if (text.length > 1000) {
      setFormError("Comment is too long (max 1000 characters).");
      return;
    }
    setFormError(null);
    postReview("rework_requested", text);
  }

  // ── Render helpers ────────────────────────────────────────

  const showActionButtons =
    status === null || status === "pending_review" || status === "rework_delivered";

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2">

      {/* ── rework_delivered banner ── */}
      {status === "rework_delivered" && (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1.5">
          <Sparkles className="w-3 h-3 flex-shrink-0" aria-hidden />
          New version ready
        </div>
      )}

      {/* ── Status badge (non-action states) ── */}
      {status && STATUS_BADGE[status] !== null && !showActionButtons && (() => {
        const cfg = STATUS_BADGE[status]!;
        return (
          <div className="flex flex-col gap-1">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold border rounded-full px-2.5 py-1 ${VARIANT_CLASSES[cfg.variant]}`}
            >
              {cfg.icon}
              {cfg.label}
            </span>
            {/* Comment preview for rework_requested */}
            {status === "rework_requested" && comment && (
              <p
                className="text-[10px] text-muted leading-snug max-w-[200px] truncate"
                title={comment}
              >
                <MessageSquare className="inline w-2.5 h-2.5 mr-0.5 -mt-px" aria-hidden />
                {comment}
              </p>
            )}
          </div>
        );
      })()}

      {/* ── Action buttons ── */}
      {showActionButtons && !showForm && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={loading !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60"
            aria-label={`Approve ${fileLabel}`}
          >
            {loading === "approve"
              ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
              : <CheckCircle2 className="w-3 h-3" aria-hidden />
            }
            Approve
          </button>

          <button
            type="button"
            onClick={handleOpenForm}
            disabled={loading !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg text-[11px] font-semibold hover:bg-amber-100 transition-colors disabled:opacity-60"
            aria-label={`Request rework for ${fileLabel}`}
          >
            <RotateCcw className="w-3 h-3" aria-hidden />
            Request rework
          </button>
        </div>
      )}

      {/* ── Inline rework form ── */}
      {showForm && (
        <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-3 space-y-2.5 w-full max-w-sm">
          <p className="text-[11px] font-semibold text-foreground">
            Describe what needs to change:
          </p>
          <textarea
            rows={3}
            maxLength={1000}
            value={draftText}
            onChange={(e) => {
              setDraftText(e.target.value);
              if (formError) setFormError(null);
            }}
            disabled={loading === "rework"}
            placeholder="e.g. The lighting feels too dark on the left side…"
            className="w-full text-[12px] border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 disabled:opacity-60 bg-white"
            aria-label="Rework request comment"
          />
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] text-muted tabular-nums">
              {draftText.length}/1000
            </span>
          </div>
          {formError && (
            <p className="flex items-center gap-1 text-[11px] text-red-600">
              <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden />
              {formError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmitRework}
              disabled={loading === "rework"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-[11px] font-semibold hover:bg-amber-700 transition-colors shadow-sm disabled:opacity-60"
            >
              {loading === "rework"
                ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                : <Send className="w-3 h-3" aria-hidden />
              }
              Submit rework request
            </button>
            <button
              type="button"
              onClick={handleCancelForm}
              disabled={loading === "rework"}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg text-[11px] font-semibold text-foreground/60 hover:text-foreground bg-white transition-colors disabled:opacity-60"
            >
              <X className="w-3 h-3" aria-hidden />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── API-level error (shown below buttons/form) ── */}
      {apiError && (
        <p className="flex items-center gap-1 text-[11px] text-red-600 mt-0.5">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden />
          {apiError}
        </p>
      )}
    </div>
  );
}
