"use client";

import { useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  FileImage,
  Hourglass,
  MessageSquare,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import DeliverableReviewActions from "@/components/dashboard/DeliverableReviewActions";
import FilePreviewCard from "@/components/FilePreviewCard";
import OrderItemDetails, {
  hasClientVisibleOrderItemDetails,
} from "@/components/order/OrderItemDetails";
import type { StaticImageViewerVariant } from "@/components/media/static-image-variant";
import type { CurrentDeliverableRow } from "@/lib/client-deliverable-display";
import {
  canShowCompletedReworkAction,
  isOneToOneImageEditingPresentation,
} from "@/lib/client-order-item-presentation";
import type { ClientSourceFile } from "@/lib/client-source-files";
import { formatBytes } from "@/lib/display/file-format";

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
  orderStatus: string;
  editLabel: string;
  imageNumber: number;
  imageCount: number;
  subtotalLabel?: string | null;
  details: Record<string, unknown>;
  sourceFiles: ClientSourceFile[];
  deliverables: CurrentDeliverableRow[];
  status: ClientImageWorkflowStatus;
  latestComment?: string | null;
}

type InitialReviewStatus = NonNullable<CurrentDeliverableRow["review"]>["status"] | null;

const STATUS_CONFIG: Record<
  ClientImageWorkflowStatus,
  { label: string; className: string; icon: ReactNode }
> = {
  awaiting_delivery: {
    label: "Awaiting delivery",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    icon: <Hourglass className="h-3 w-3" aria-hidden />,
  },
  ready_for_review: {
    label: "Ready for review",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: <Clock className="h-3 w-3" aria-hidden />,
  },
  pending_rework: {
    label: "Pending Rework",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: <RotateCcw className="h-3 w-3" aria-hidden />,
  },
  rework_in_progress: {
    label: "Rework In Progress",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: <Clock className="h-3 w-3" aria-hidden />,
  },
  new_version_ready: {
    label: "New Version Ready",
    className: "border-purple-200 bg-purple-50 text-purple-700",
    icon: <Sparkles className="h-3 w-3" aria-hidden />,
  },
  approved: {
    label: "Approved",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: <CheckCircle2 className="h-3 w-3" aria-hidden />,
  },
  resolved: {
    label: "Resolved",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: <CheckCircle2 className="h-3 w-3" aria-hidden />,
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
  orderStatus,
  editLabel,
  imageNumber,
  imageCount,
  subtotalLabel = null,
  details,
  sourceFiles,
  deliverables,
  status,
  latestComment = null,
}: Props) {
  const [mediaAspectRatio, setMediaAspectRatio] = useState<number | null>(null);
  const statusConfig = STATUS_CONFIG[status];
  const originalSource = sourceFiles.find((file) => file.kind === "original") ?? null;
  const referenceSources = sourceFiles.filter((file) => file.kind === "reference");
  const hasPreferences = hasClientVisibleOrderItemDetails(details);
  const usesOneToOneLayout = isOneToOneImageEditingPresentation({
    details,
    hasOriginalSource: originalSource !== null,
    referenceCount: referenceSources.length,
    deliverableCount: deliverables.length,
  });
  const canRequestRework = canShowCompletedReworkAction(
    orderStatus,
    deliverables.length > 0,
  );

  function handleOriginalAspectRatio(nextAspectRatio: number) {
    if (!Number.isFinite(nextAspectRatio) || nextAspectRatio <= 0) return;
    setMediaAspectRatio((currentAspectRatio) =>
      currentAspectRatio !== null && Math.abs(currentAspectRatio - nextAspectRatio) < 0.01
        ? currentAspectRatio
        : nextAspectRatio,
    );
  }

  const originalPanel = (
    <WorkflowPanel title="Original">
      {originalSource ? (
        <FilePreviewCard
          presentation="feature"
          mediaAspectRatio={mediaAspectRatio}
          onImageAspectRatio={handleOriginalAspectRatio}
          viewerVariant={viewerVariant}
          filename={originalSource.filename}
          mimeType={originalSource.mimeType}
          fileSizeLabel={formatBytes(originalSource.fileSize)}
          badgeLabel="Original"
          signedUrlEndpoint={`/api/client/orders/${orderId}/source-files/${originalSource.id}/download-url`}
          downloadLabel="Download"
        />
      ) : (
        <SourcePlaceholder mediaAspectRatio={mediaAspectRatio} />
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
  );

  const deliveredPanel = (
    <WorkflowPanel title="Delivered">
      {deliverables.length > 0 ? (
        <ul className="space-y-5">
          {deliverables.map(({ deliverable, review, isReplacement, previousFilename }) => (
            <li key={deliverable.id}>
              <FilePreviewCard
                presentation="feature"
                mediaAspectRatio={mediaAspectRatio}
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
                      <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                        New version
                      </span>
                    )}
                    {previousFilename && (
                      <p className="text-[10px] text-muted">Replaces {previousFilename}</p>
                    )}
                  </div>
                }
                actions={
                  canRequestRework ? (
                    <CompletedReworkArea
                      deliverableId={deliverable.id}
                      initialReviewStatus={review?.status ?? null}
                      initialComment={review?.comment ?? null}
                      filename={deliverable.filename}
                    />
                  ) : null
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <DeliveredPlaceholder mediaAspectRatio={mediaAspectRatio} />
      )}
    </WorkflowPanel>
  );

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
        {usesOneToOneLayout ? (
          <div className="grid grid-cols-1 items-start gap-7 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
            {originalPanel}
            {deliveredPanel}
            {hasPreferences ? (
              <PreferencesPanel
                details={details}
                editLabel={editLabel}
                className="md:col-span-2 lg:col-span-1"
              />
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-2 lg:gap-6">
            {originalPanel}
            {deliveredPanel}
          </div>
        )}

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

        {!usesOneToOneLayout && hasPreferences ? (
          <PreferencesPanel
            details={details}
            editLabel={editLabel}
            className="mt-6 border-t border-border pt-4"
          />
        ) : null}
      </div>
    </article>
  );
}

function PreferencesPanel({
  details,
  editLabel,
  className = "",
}: {
  details: Record<string, unknown>;
  editLabel: string;
  className?: string;
}) {
  return (
    <section className={`min-w-0 ${className}`} aria-label="Editing preferences">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Edit</p>
      <p className="mt-1 text-[14px] font-semibold leading-snug text-foreground">{editLabel}</p>
      <details open className="group mt-5 border-t border-border pt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          Preferences / options
          <ChevronDown
            className="h-4 w-4 flex-shrink-0 text-muted transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="pt-3">
          <OrderItemDetails details={details} variant="specification" />
        </div>
      </details>
    </section>
  );
}

function CompletedReworkArea({
  deliverableId,
  initialReviewStatus,
  initialComment,
  filename,
}: {
  deliverableId: string;
  initialReviewStatus: InitialReviewStatus;
  initialComment: string | null;
  filename: string;
}) {
  return (
    <section aria-label={`Request changes for ${filename}`}>
      <p className="text-[13px] font-semibold text-foreground">Need any changes?</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">
        Request adjustments to the delivered result.
      </p>
      <div className="mt-3">
        <DeliverableReviewActions
          deliverableId={deliverableId}
          initialReviewStatus={initialReviewStatus}
          initialComment={initialComment}
          filename={filename}
          presentation="compact"
        />
      </div>
    </section>
  );
}

function SourcePlaceholder({ mediaAspectRatio }: { mediaAspectRatio: number | null }) {
  return (
    <div
      className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/60 px-4 py-5 text-center"
      style={mediaAspectRatio ? { aspectRatio: mediaAspectRatio } : undefined}
    >
      <FileImage className="h-8 w-8 text-muted-light" aria-hidden />
      <p className="mt-2 text-[13px] font-semibold text-foreground">Original uploaded file</p>
      <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-muted">Preview coming soon</p>
    </div>
  );
}

function DeliveredPlaceholder({ mediaAspectRatio }: { mediaAspectRatio: number | null }) {
  return (
    <div
      className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded-lg border border-blue-100 bg-blue-50/60 px-5 py-6 text-center"
      style={mediaAspectRatio ? { aspectRatio: mediaAspectRatio } : undefined}
    >
      <Clock className="h-7 w-7 text-blue-600/80" aria-hidden />
      <p className="mt-2 text-[13px] font-semibold text-blue-900">Awaiting delivery</p>
      <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-blue-800/75">
        The finished file for this image will appear here when it is ready.
      </p>
    </div>
  );
}

function WorkflowPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        {title}
      </h4>
      {children}
    </section>
  );
}
