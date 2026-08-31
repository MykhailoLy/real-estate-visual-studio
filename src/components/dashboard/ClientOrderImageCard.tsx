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
import { formatBytes } from "@/lib/display/file-format";
import type { StaticImageViewerVariant } from "@/components/media/static-image-variant";

export type ClientImageWorkflowStatus =
  | "awaiting_delivery"
  | "ready_for_review"
  | "pending_rework"
  | "rework_in_progress"
  | "new_version_ready"
  | "approved"
  | "resolved";

interface Props {
  viewerVariant: StaticImageViewerVariant;
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
  viewerVariant,
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
  const referenceSources = sourceFiles.filter((file) => file.kind === "reference");

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-primary">
            Image {imageNumber} of {imageCount}
          </h3>
          {subtotalLabel && (
            <p className="mt-1 text-[12px] font-semibold tabular-nums text-muted">
              Subtotal · {subtotalLabel}
            </p>
          )}
        </div>
        <span
          className={`inline-flex self-start items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold sm:self-center ${statusConfig.className}`}
        >
          {statusConfig.icon}
          {statusConfig.label}
        </span>
      </div>

      <div className="pt-5">
        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-2 lg:gap-6">
          <WorkflowPanel title="Original">
            {originalSource ? (
              <FeatureFilePreview>
                <FilePreviewCard
                  viewerVariant={viewerVariant}
                  filename={originalSource.filename}
                  mimeType={originalSource.mimeType}
                  fileSizeLabel={formatBytes(originalSource.fileSize)}
                  badgeLabel="Original"
                  signedUrlEndpoint={`/api/client/orders/${orderId}/source-files/${originalSource.id}/download-url`}
                  downloadLabel="Download"
                />
              </FeatureFilePreview>
            ) : (
              <SourcePlaceholder />
            )}

            {referenceSources.length > 0 && (
              <div className="mt-5 border-t border-border pt-5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                  Reference files
                </p>
                <ul className="divide-y divide-border">
                  {referenceSources.map((referenceSource, index) => (
                    <li key={referenceSource.id} className="py-3 first:pt-0 last:pb-0">
                      <FilePreviewCard
                        viewerVariant={viewerVariant}
                        filename={referenceSource.filename}
                        mimeType={referenceSource.mimeType}
                        fileSizeLabel={formatBytes(referenceSource.fileSize)}
                        badgeLabel={`Reference ${index + 1}`}
                        signedUrlEndpoint={`/api/client/orders/${orderId}/source-files/${referenceSource.id}/download-url`}
                        downloadLabel="Download"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </WorkflowPanel>

          <WorkflowPanel title="Delivered">
            {deliverables.length > 0 ? (
              <ul className="space-y-3">
                {deliverables.map(({ deliverable, review, isReplacement, previousFilename }) => (
                  <li key={deliverable.id}>
                    <FeatureFilePreview>
                      <FilePreviewCard
                        viewerVariant={viewerVariant}
                        filename={deliverable.filename}
                        mimeType={deliverable.mime_type}
                        fileSizeLabel={formatBytes(deliverable.file_size)}
                        badgeLabel="Delivered"
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
                          <div className="w-full border-t border-border pt-3">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light">
                              Need something changed?
                            </p>
                            <DeliverableReviewActions
                              deliverableId={deliverable.id}
                              initialReviewStatus={review?.status ?? null}
                              initialComment={review?.comment ?? null}
                              filename={deliverable.filename}
                            />
                          </div>
                        }
                      />
                    </FeatureFilePreview>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex min-h-32 h-full flex-col items-center justify-center rounded-lg bg-blue-50/70 px-4 py-5 text-center">
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

        </div>

        {COMMENT_STATUSES.has(status) && latestComment && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-3">
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-amber-900">
              <MessageSquare className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
              <span>
                <span className="font-semibold">Latest rework note:</span> {latestComment}
              </span>
            </p>
          </div>
        )}

        <details className="mt-6 border-t border-border pt-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            Editing instructions
            <span className="text-[12px] font-medium text-muted">View preferences</span>
          </summary>
          <div className="pt-3">
            <OrderItemDetails details={details} variant="specification" />
          </div>
        </details>
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

function FeatureFilePreview({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={[
        "[&>div]:items-stretch [&>div]:flex-col",
        "[&>div>button:first-child]:!h-56 [&>div>button:first-child]:!w-full",
        "[&>div>button:first-child]:sm:!h-64 [&>div>button:first-child]:lg:!h-72",
        "[&>div>div:last-child]:items-start [&>div>div:last-child]:sm:flex-row",
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
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        {title}
      </h4>
      {children}
    </section>
  );
}
