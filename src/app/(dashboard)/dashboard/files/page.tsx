// ============================================================
// /dashboard/files — real deliverables (Phase 5B)
//
// Server component. Fetches the authenticated client's
// deliverables via getDeliverablesByClientEmail() and renders
// a download card for each one. The download button calls
// POST /api/client/deliverables/[id]/download-url which
// returns a 300-second signed URL — the storage path never
// reaches the browser.
// ============================================================

import Link from "next/link";
import { FolderOpen, PlusCircle, Tag } from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import { getClientUser } from "@/lib/client-auth";
import { getDeliverablesByClientEmail } from "@/lib/client-deliverables";
import { getReviewsByClientEmail } from "@/lib/client-reviews";
import type { ReviewStatus } from "@/lib/client-reviews";
import DeliverableDownloadButton from "@/components/dashboard/DeliverableDownloadButton";
import DeliverableReviewActions from "@/components/dashboard/DeliverableReviewActions";

/** Human-readable label for item_index. Mirrors the admin helper. */
function itemLabel(itemIndex: number | null): string {
  return itemIndex === null ? "Order-level" : `Image ${itemIndex + 1}`;
}

export const metadata = {
  title: "Files | PicchuSpot Client Portal",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return iso; }
}

export default async function DashboardFilesPage() {
  const user = await getClientUser();

  const [deliverables, reviews] = user?.email
    ? await Promise.all([
        getDeliverablesByClientEmail(user.email),
        getReviewsByClientEmail(user.email),
      ])
    : [[], []];

  // Build deliverable_id → latest review map (reviews are newest-first).
  const reviewMap = new Map<string, { status: ReviewStatus; comment: string | null }>();
  for (const rev of reviews) {
    if (!reviewMap.has(rev.deliverable_id)) {
      reviewMap.set(rev.deliverable_id, { status: rev.status, comment: rev.comment });
    }
  }

  return (
    <ClientDashboardLayout>
      {/* Page header */}
      <div className="mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark mb-1.5">
          Client Portal
        </p>
        <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
          Delivered Files
        </h1>
        <p className="text-muted mt-1 text-sm">
          Download your completed visuals. Download links expire after 5 minutes.
        </p>
        <p className="text-muted mt-1 text-xs">
          If your browser opens the file instead of saving it, use{" "}
          <strong className="font-semibold text-foreground">Save / Share</strong>{" "}
          to save it to your device.
        </p>
      </div>

      {deliverables.length === 0 ? (
        /* ── Empty state ── */
        <div className="bg-white border border-border rounded-2xl p-10 flex flex-col items-center justify-center text-center mb-6 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center mb-5">
            <FolderOpen className="w-6 h-6 text-muted-light" aria-hidden />
          </div>
          <h2 className="text-base font-bold text-foreground mb-2">
            No files available yet
          </h2>
          <p className="text-sm text-muted max-w-sm leading-relaxed mb-6">
            Completed deliverables will appear here once your order is delivered.
            We&rsquo;ll also send them to your email address.
          </p>
          <Link
            href="/dashboard/jobs"
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:text-primary-light transition-colors"
          >
            View your orders →
          </Link>
        </div>
      ) : (
        /* ── File cards ── */
        <div className="space-y-3 mb-6">
          {deliverables.map((d) => {
            const rev = reviewMap.get(d.id) ?? null;
            return (
            <div
              key={d.id}
              className="bg-white border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/6 border border-primary/10 flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="w-5 h-5 text-primary" aria-hidden />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-[13px] leading-snug">
                    {d.filename}
                  </p>
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1">
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary bg-primary/8 border border-primary/15 px-1.5 py-0.5 rounded-full">
                      <Tag className="w-2.5 h-2.5" aria-hidden />
                      {itemLabel(d.item_index)}
                    </span>
                    <span className="text-[10px] text-muted font-mono bg-surface px-1.5 py-0.5 rounded">
                      {d.order_number}
                    </span>
                    <span className="text-[11px] text-muted">
                      {formatBytes(d.file_size)}
                    </span>
                    <span className="text-[11px] text-muted">
                      Delivered {formatDate(d.uploaded_at)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 flex-shrink-0 sm:items-end">
                <DeliverableDownloadButton deliverableId={d.id} filename={d.filename} />
                <DeliverableReviewActions
                  deliverableId={d.id}
                  initialReviewStatus={rev?.status ?? null}
                  initialComment={rev?.comment ?? null}
                  filename={d.filename}
                />
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Bottom info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="w-4 h-4 text-primary" aria-hidden />
            <h3 className="text-sm font-bold text-foreground">About your files</h3>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            We deliver high-resolution JPEG files (min. 3000px on the long edge)
            unless otherwise specified. Final files are watermark-free and ready
            for MLS, print, or digital marketing use.
          </p>
        </div>
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <PlusCircle className="w-4 h-4 text-secondary-dark" aria-hidden />
            <h3 className="text-sm font-bold text-foreground">Need more visuals?</h3>
          </div>
          <p className="text-xs text-muted leading-relaxed mb-3">
            Place a new order and we&rsquo;ll have your completed visuals ready
            within 24–48 hours.
          </p>
          <Link
            href="/order"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-primary hover:text-primary-light transition-colors"
          >
            Create a new order →
          </Link>
        </div>
      </div>
    </ClientDashboardLayout>
  );
}
