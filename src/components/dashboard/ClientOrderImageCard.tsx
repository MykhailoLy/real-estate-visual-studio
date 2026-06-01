"use client";

import type React from "react";
import {
  CheckCircle2,
  Clock,
  FileImage,
  Hourglass,
  MessageSquare,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import DeliverableReviewActions from "@/components/dashboard/DeliverableReviewActions";
import FilePreviewCard from "@/components/FilePreviewCard";
import OrderItemDetails from "@/components/order/OrderItemDetails";
import type { CurrentDeliverableRow } from "@/lib/client-deliverable-display";
import type { ClientSourceFile } from "@/lib/client-source-files";

export type ClientImageWorkflowStatus =
  | "awaiting_delivery"
  | "ready_for_review"
  | "pending_rework"
  | "rework_in_progress"
  | "new_version_ready"
  | "approved"
  | "resolved";

interface Props {
  orderId: string;
  imageNumber: number;
  imageCount: number;
  subtotalLabel?: string | null;
  details: Record<string, unknown>;
  sourceFiles: ClientSourceFile[];
  deliverables: CurrentDeliverableRow[];
  status: ClientImageWorkflowStatus;
  latestComment?: string | null;
}

const STATUS_CONFIG: Record<
  ClientImageWorkflowStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  awaiting_delivery: {
    label: "Awaiting delivery",
    className: "bg-slate-50 text-slate-600 border-slate-200",
    icon: <Hourglass className="w-3 h-3" aria-hidden />,
  },
  ready_for_review: {
    label: "Ready for review",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Clock className="w-3 h-3" aria-hidden />,
  },
  pending_rework: {
    label: "Pending Rework",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <RotateCcw className="w-3 h-3" aria-hidden />,
  },
  rework_in_progress: {
    label: "Rework In Progress",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Clock className="w-3 h-3" aria-hidden />,
  },
  new_version_ready: {
    label: "New Version Ready",
    className: "bg-purple-50 text-purple-700 border-purple-200",
    icon: <Sparkles className="w-3 h-3" aria-hidden />,
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="w-3 h-3" aria-hidden />,
  },
  resolved: {
    label: "Resolved",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="w-3 h-3" aria-hidden />,
  },
};

const COMMENT_STATUSES = new Set<ClientImageWorkflowStatus>([
  "pending_rework",
  "rework_in_progress",
  "new_version_ready",
]);

export default function ClientOrderImageCard({
  orderId,
  imageNumber,
  imageCount,
  subtotalLabel = null,
  details,
  sourceFiles,
  deliverables,
  status,
  latestComment = null,
}: Props) {
  const statusConfig = STATUS_CONFIG[status];
  const originalSource = sourceFiles.find((file) => file.kind === "original") ?? null;
  const referenceSource = sourceFiles.find((file) => file.kind === "reference") ?? null;

  return (
    <article className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border bg-surface/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-foreground">
            Image {imageNumber} of {imageCount}
          </h3>
          {subtotalLabel && (
            <p className="mt-0.5 text-[11px] font-semibold text-muted tabular-nums">
              {subtotalLabel}
            </p>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold self-start sm:self-center ${statusConfig.className}`}
        >
          {statusConfig.icon}
          {statusConfig.label}
        </span>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.05fr)_minmax(0,0.9fr)] gap-4 xl:gap-5 items-start">
          <WorkflowPanel title="Original / Before">
            {originalSource ? (
              <LargePreviewFrame>
                <FilePreviewCard
                  filename={originalSource.filename}
                  mimeType={originalSource.mimeType}
                  fileSizeLabel={formatOptionalBytes(originalSource.fileSize)}
                  badgeLabel="Original"
                  signedUrlEndpoint={`/api/client/orders/${orderId}/source-files/${originalSource.id}/download-url`}
                  downloadLabel="Download"
                />
              </LargePreviewFrame>
            ) : (
              <SourcePlaceholder />
            )}

            {referenceSource && (
              <div className="mt-3 rounded-lg border border-border bg-surface/30 p-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light">
                  Reference file
                </p>
                <FilePreviewCard
                  filename={referenceSource.filename}
                  mimeType={referenceSource.mimeType}
                  fileSizeLabel={formatOptionalBytes(referenceSource.fileSize)}
                  badgeLabel="Reference"
                  signedUrlEndpoint={`/api/client/orders/${orderId}/source-files/${referenceSource.id}/download-url`}
                  downloadLabel="Download"
                />
              </div>
            )}
          </WorkflowPanel>

          <WorkflowPanel title="Delivered / After">
            {deliverables.length > 0 ? (
              <ul className="space-y-3">
                {deliverables.map(({ deliverable, review, isReplacement, previousFilename }) => (
                  <li key={deliverable.id}>
                    <LargePreviewFrame>
                      <FilePreviewCard
                        filename={deliverable.filename}
                        mimeType={deliverable.mime_type}
                        fileSizeLabel={formatBytes(deliverable.file_size)}
                        badgeLabel={`Image ${imageNumber}`}
                        signedUrlEndpoint={`/api/client/deliverables/${deliverable.id}/download-url`}
                        downloadLabel="Download file"
                        meta={
                          <div className="space-y-1">
                            {isReplacement && (
                              <span className="inline-flex items-center text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full">
                                New version
                              </span>
                            )}
                            {previousFilename && (
                              <p className="text-[10px] text-muted">
                                Replaces {previousFilename}
                              </p>
                            )}
                          </div>
                        }
                        actions={
                          <DeliverableReviewActions
                            deliverableId={deliverable.id}
                            initialReviewStatus={review?.status ?? null}
                            initialComment={review?.comment ?? null}
                            filename={deliverable.filename}
                          />
                        }
                      />
                    </LargePreviewFrame>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-full min-h-32 rounded-lg border border-border bg-blue-50/70 px-4 py-5 flex flex-col items-center justify-center text-center">
                <Clock className="w-7 h-7 text-blue-600" aria-hidden />
                <p className="mt-2 text-[13px] font-semibold text-blue-800">
                  Awaiting delivery
                </p>
                <p className="mt-1 text-[11px] text-blue-700/80 leading-relaxed max-w-xs">
                  The finished file for this image will appear here when it is ready.
                </p>
              </div>
            )}
          </WorkflowPanel>

          <WorkflowPanel title="Request details">
            <div className="rounded-lg border border-border bg-surface/30 p-4">
              <OrderItemDetails details={details} />
            </div>
            {COMMENT_STATUSES.has(status) && latestComment && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5">
                <p className="flex items-start gap-1.5 text-[12px] text-amber-900 leading-relaxed">
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden />
                  <span>
                    <span className="font-semibold">Latest rework note:</span> {latestComment}
                  </span>
                </p>
              </div>
            )}
          </WorkflowPanel>
        </div>
      </div>
    </article>
  );
}

function SourcePlaceholder() {
  return (
    <div className="h-full min-h-56 rounded-lg border border-dashed border-border bg-surface/60 px-4 py-5 flex flex-col items-center justify-center text-center">
      <FileImage className="w-8 h-8 text-muted-light" aria-hidden />
      <p className="mt-2 text-[13px] font-semibold text-foreground">
        Original uploaded file
      </p>
      <p className="mt-1 text-[11px] text-muted leading-relaxed max-w-xs">
        Preview coming soon
      </p>
    </div>
  );
}

function LargePreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={[
        "rounded-lg border border-border bg-white p-3",
        "[&>div]:sm:flex-col [&>div]:sm:items-stretch",
        "[&>div>button:first-child]:sm:!w-full",
        "[&>div>button:first-child]:sm:!h-56",
        "[&>div>button:first-child]:lg:!h-64",
        "[&>div>button:first-child]:xl:!h-72",
        "[&>div>div:last-child]:sm:flex-row",
        "[&>div>div:last-child]:sm:items-start",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function WorkflowPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 h-full">
      <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-light mb-2">
        {title}
      </h4>
      {children}
    </section>
  );
}

function formatOptionalBytes(bytes: number | null): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return null;
  return formatBytes(bytes);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
