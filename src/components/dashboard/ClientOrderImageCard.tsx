"use client";

import type { ReactNode } from "react";
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
import type { JobImageViewerItem } from "@/lib/client-job-image-navigation";

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
  originalViewerItems: JobImageViewerItem[];
  deliveredViewerItems: JobImageViewerItem[];
  status: ClientImageWorkflowStatus;
  latestComment?: string | null;
  summaryReworkDeliverableId?: string | null;
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
  originalViewerItems,
  deliveredViewerItems,
  status,
  latestComment = null,
  summaryReworkDeliverableId = null,
}: Props) {
  const statusConfig = STATUS_CONFIG[status];
  const originalSource = sourceFiles.find((file) => file.kind === "original") ?? null;
  const referenceSources = sourceFiles.filter((file) => file.kind === "reference");
  const hasPreferences = hasClientVisibleOrderItemDetails(details);
  const usesOneToOneLayout = isOneToOneImageEditingPresentation({
    details,
    hasOriginalSource: originalSource !== null,
    deliverableCount: deliverables.length,
  });
  const canRequestRework = canShowCompletedReworkAction(
    orderStatus,
    deliverables.length > 0,
  );

  const originalPanel = (
    <WorkflowPanel title="Original">
      {originalSource ? (
        <FilePreviewCard
          presentation="feature"
          viewerVariant={viewerVariant}
          filename={originalSource.filename}
          mimeType={originalSource.mimeType}
          fileSizeLabel={formatBytes(originalSource.fileSize)}
          badgeLabel="Original"
          signedUrlEndpoint={`/api/client/orders/${orderId}/source-files/${originalSource.id}/download-url`}
          viewerItems={originalViewerItems}
          viewerItemId={`source:${originalSource.id}`}
          downloadLabel="Download"
        />
      ) : (
        <SourcePlaceholder />
      )}

      {referenceSources.length > 0 && (
        <div className="mt-5 border-t border-border pt-5">
          <p className="mb-2 text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-muted">
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
          {deliverables.map(({ deliverable, isReplacement, previousFilename }) => (
            <li key={deliverable.id}>
              <FilePreviewCard
                presentation="feature"
                viewerVariant={viewerVariant}
                filename={deliverable.filename}
                mimeType={deliverable.mime_type}
                fileSizeLabel={formatBytes(deliverable.file_size)}
                badgeLabel="Delivered"
                signedUrlEndpoint={`/api/client/deliverables/${deliverable.id}/download-url`}
                viewerItems={deliveredViewerItems}
                viewerItemId={`deliverable:${deliverable.id}`}
                downloadLabel="Download file"
                meta={
                  <div className="space-y-1">
                    {isReplacement && (
                      <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-dashboard-metadata font-semibold text-purple-700">
                        New version
                      </span>
                    )}
                    {previousFilename && (
                      <p className="text-dashboard-metadata text-muted">Replaces {previousFilename}</p>
                    )}
                  </div>
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <DeliveredPlaceholder />
      )}
    </WorkflowPanel>
  );

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
      <div className="border-b border-border pb-4">
        <div className="min-w-0">
          <h3 className="text-dashboard-action font-bold uppercase tracking-[0.08em] text-primary">
            Image {imageNumber} of {imageCount}
          </h3>
          {subtotalLabel && (
            <p className="mt-1 text-dashboard-metadata font-semibold tabular-nums text-muted">
              Subtotal · {subtotalLabel}
            </p>
          )}
        </div>
      </div>

      <div className="pt-5">
        {usesOneToOneLayout ? (
          <div className="grid grid-cols-1 items-start gap-7 md:grid-cols-2 md:gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,7fr)_minmax(16rem,6fr)]">
            {originalPanel}
            {deliveredPanel}
            <WorkflowDetailsPanel
              details={details}
              editLabel={editLabel}
              hasPreferences={hasPreferences}
              statusConfig={statusConfig}
              latestComment={latestComment}
              showLatestComment={COMMENT_STATUSES.has(status)}
              deliverables={deliverables}
              canRequestRework={canRequestRework}
              summaryReworkDeliverableId={summaryReworkDeliverableId}
              className="md:col-span-2 lg:col-span-1"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-2 lg:gap-6">
            {originalPanel}
            {deliveredPanel}
            <WorkflowDetailsPanel
              details={details}
              editLabel={editLabel}
              hasPreferences={hasPreferences}
              statusConfig={statusConfig}
              latestComment={latestComment}
              showLatestComment={COMMENT_STATUSES.has(status)}
              deliverables={deliverables}
              canRequestRework={canRequestRework}
              summaryReworkDeliverableId={summaryReworkDeliverableId}
              className="lg:col-span-2"
            />
          </div>
        )}
      </div>
    </article>
  );
}

function WorkflowDetailsPanel({
  details,
  editLabel,
  hasPreferences,
  statusConfig,
  latestComment,
  showLatestComment,
  deliverables,
  canRequestRework,
  summaryReworkDeliverableId,
  className = "",
}: {
  details: Record<string, unknown>;
  editLabel: string;
  hasPreferences: boolean;
  statusConfig: (typeof STATUS_CONFIG)[ClientImageWorkflowStatus];
  latestComment: string | null;
  showLatestComment: boolean;
  deliverables: CurrentDeliverableRow[];
  canRequestRework: boolean;
  summaryReworkDeliverableId: string | null;
  className?: string;
}) {
  const workflowReworkDeliverables = deliverables.filter(
    ({ deliverable }) => deliverable.id !== summaryReworkDeliverableId,
  );

  return (
    <section className={`min-w-0 ${className}`} aria-label="Editing preferences and workflow status">
      <p className="text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-muted">Edit</p>
      <p className="mt-1 text-[14px] font-semibold leading-snug text-foreground">{editLabel}</p>
      {hasPreferences ? (
        <details open className="group mt-5 border-t border-border pt-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-dashboard-action font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
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
      ) : null}

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-muted">
          Workflow status
        </p>
        <span
          className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-dashboard-metadata font-semibold ${statusConfig.className}`}
        >
          {statusConfig.icon}
          {statusConfig.label}
        </span>

        {showLatestComment && latestComment ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-3 text-dashboard-body text-amber-900">
            <MessageSquare className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">Latest rework note:</span> {latestComment}
            </span>
          </p>
        ) : null}

        {canRequestRework && workflowReworkDeliverables.length > 0 ? (
          <div className="mt-5 space-y-5 border-t border-border pt-4">
            {workflowReworkDeliverables.map(({ deliverable, review }) => (
              <CompletedReworkArea
                key={deliverable.id}
                deliverableId={deliverable.id}
                initialReviewStatus={review?.status ?? null}
                initialComment={review?.comment ?? null}
                filename={deliverable.filename}
              />
            ))}
          </div>
        ) : null}
      </div>
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
      <p className="text-dashboard-action font-semibold text-foreground">Need any changes?</p>
      <p className="mt-1 text-dashboard-body text-muted">
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

function SourcePlaceholder() {
  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/60 px-4 py-5 text-center">
      <FileImage className="h-8 w-8 text-muted-light" aria-hidden />
      <p className="mt-2 text-dashboard-action font-semibold text-foreground">Original uploaded file</p>
      <p className="mt-1 max-w-xs text-dashboard-body text-muted">Preview coming soon</p>
    </div>
  );
}

function DeliveredPlaceholder() {
  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded-lg border border-blue-100 bg-blue-50/60 px-5 py-6 text-center">
      <Clock className="h-7 w-7 text-blue-600/80" aria-hidden />
      <p className="mt-2 text-dashboard-action font-semibold text-blue-900">Awaiting delivery</p>
      <p className="mt-1 max-w-xs text-dashboard-body text-blue-800/75">
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
      <h4 className="mb-2 text-dashboard-action font-bold uppercase tracking-[0.06em] text-muted">
        {title}
      </h4>
      {children}
    </section>
  );
}
