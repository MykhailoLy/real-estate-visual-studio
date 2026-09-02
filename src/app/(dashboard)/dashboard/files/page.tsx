import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileImage,
  FolderOpen,
  HardDrive,
  ImageIcon,
  Layers,
  PlusCircle,
  UploadCloud,
} from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import FilePreviewCard from "@/components/FilePreviewCard";
import { getDashboardRequestUser } from "@/lib/dashboard-request-context";
import {
  getClientFilesHubData,
  type ClientDeliveredFileHubItem,
  type ClientUploadedFileHubItem,
} from "@/lib/client-files";
import { toOrderOwnership } from "@/lib/order-ownership";
import { formatBytes, formatDate, itemLabel } from "@/lib/display/file-format";
import { getOrderStatusLabel } from "@/lib/display/status-labels";
import { cn } from "@/lib/utils";
import { getStaticImageViewerVariantForService } from "@/components/media/static-image-variant";

export const metadata = {
  title: "Files | PicchuSpot Client Portal",
};

function sourceKindLabel(kind: ClientUploadedFileHubItem["kind"]): string {
  return kind === "original" ? "Original" : "Reference";
}

function SummaryCard({
  label,
  value,
  note,
  icon: Icon,
  iconClassName,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof FolderOpen;
  iconClassName: string;
}) {
  return (
    <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-dashboard-kicker font-bold uppercase text-muted-light mb-1">
            {label}
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {value}
          </p>
        </div>
        <div className="h-9 w-9 rounded-xl bg-surface border border-border flex items-center justify-center">
          <Icon className={cn("h-4 w-4", iconClassName)} aria-hidden />
        </div>
      </div>
      <p className="text-dashboard-metadata text-muted mt-2">{note}</p>
    </div>
  );
}

function ViewOrderAction({ orderId }: { orderId: string }) {
  return (
    <ClientPortalLink
      href={`/dashboard/jobs/${orderId}`}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-dashboard-action font-semibold text-foreground/70 hover:border-primary/40 hover:text-primary transition-colors"
    >
      View order
      <ArrowRight className="w-3.5 h-3.5" aria-hidden />
    </ClientPortalLink>
  );
}

function FileMeta({
  orderNumber,
  serviceLabel,
  item,
  dateLabel,
  status,
}: {
  orderNumber: string;
  serviceLabel: string;
  item: string;
  dateLabel: string;
  status: string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-dashboard-metadata text-muted">
      <span className="font-mono bg-surface px-1.5 py-0.5 rounded">
        {orderNumber}
      </span>
      <span className="line-clamp-2 break-words" title={serviceLabel}>
        {serviceLabel}
      </span>
      <span>{item}</span>
      <span>{dateLabel}</span>
      <span className="inline-flex items-center rounded-full border border-border bg-surface px-1.5 py-0.5 text-dashboard-metadata font-semibold text-foreground/70">
        {getOrderStatusLabel(status)}
      </span>
    </div>
  );
}

function DeliveredFileCard({ file }: { file: ClientDeliveredFileHubItem }) {
  return (
    <li className="bg-white border border-border rounded-xl p-4 shadow-sm">
      <FilePreviewCard
        viewerVariant={getStaticImageViewerVariantForService(file.order.service_type)}
        filename={file.filename}
        mimeType={file.mime_type}
        fileSizeLabel={formatBytes(file.file_size)}
        badgeLabel="Delivered"
        signedUrlEndpoint={`/api/client/deliverables/${file.id}/download-url`}
        downloadLabel="Download"
        meta={
          <FileMeta
            orderNumber={file.order_number}
            serviceLabel={file.order.service_label}
            item={itemLabel(file.item_index)}
            dateLabel={`Delivered ${formatDate(file.uploaded_at)}`}
            status={file.order.status}
          />
        }
        actions={<ViewOrderAction orderId={file.order_id} />}
      />
    </li>
  );
}

function UploadedFileCard({ file }: { file: ClientUploadedFileHubItem }) {
  const label = sourceKindLabel(file.kind);

  return (
    <li className="bg-white border border-border rounded-xl p-4 shadow-sm">
      <FilePreviewCard
        viewerVariant={getStaticImageViewerVariantForService(file.order.service_type)}
        filename={file.filename}
        mimeType={file.mime_type}
        fileSizeLabel={formatBytes(file.file_size)}
        badgeLabel={label}
        signedUrlEndpoint={`/api/client/orders/${file.order_id}/source-files/${file.id}/download-url`}
        downloadLabel="Download"
        meta={
          <FileMeta
            orderNumber={file.order_number}
            serviceLabel={file.order.service_label}
            item={itemLabel(file.item_index)}
            dateLabel={`Order submitted ${formatDate(file.order.created_at)}`}
            status={file.order.status}
          />
        }
        actions={<ViewOrderAction orderId={file.order_id} />}
      />
    </li>
  );
}

function SectionEmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="bg-white border border-dashed border-border rounded-xl p-6 text-center">
      <p className="text-dashboard-action font-semibold text-foreground">{title}</p>
      <p className="text-dashboard-body text-muted mt-1 max-w-md mx-auto">
        {body}
      </p>
    </div>
  );
}

export default async function DashboardFilesPage() {
  const user = await getDashboardRequestUser();
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const data = user && !user.isQaPreview
    ? await getClientFilesHubData(toOrderOwnership(user))
    : { orders: [], deliveredFiles: [], uploadedFiles: [] };

  const { orders, deliveredFiles, uploadedFiles } = data;
  const originalCount = uploadedFiles.filter((file) => file.kind === "original").length;
  const totalFileCount = deliveredFiles.length + uploadedFiles.length;
  const orderIdsWithFiles = new Set([
    ...deliveredFiles.map((file) => file.order_id),
    ...uploadedFiles.map((file) => file.order_id),
  ]);
  const totalKnownBytes = [
    ...deliveredFiles.map((file) => file.file_size),
    ...uploadedFiles.map((file) => file.file_size),
  ].reduce<number>(
    (sum, size) => sum + (typeof size === "number" ? size : 0),
    0,
  );
  const totalKnownSize = totalKnownBytes > 0 ? formatBytes(totalKnownBytes) : null;
  const hasFiles = totalFileCount > 0;

  return (
    <ClientDashboardLayout>
      <div className="mb-7">
        <p className="text-dashboard-kicker font-bold uppercase text-secondary-dark mb-1.5">
          Client Portal
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
              Files
            </h1>
            <p className="text-dashboard-body text-muted mt-1 md:text-base">
              Access your uploaded originals and delivered files across all orders.
            </p>
          </div>
          <ClientPortalLink
            href="/dashboard/orders/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-dashboard-action font-bold hover:bg-primary-light transition-colors shadow-sm whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" aria-hidden />
            New Order
          </ClientPortalLink>
        </div>
      </div>

      {!user && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden />
          <div>
            <p className="text-dashboard-body font-semibold text-amber-800">
              Sign in to view your files.
            </p>
            <p className="text-dashboard-metadata text-amber-700 mt-1">
              Files are loaded from your authenticated client account.
            </p>
          </div>
        </div>
      )}

      {user && !supabaseConfigured && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden />
          <div>
            <p className="text-dashboard-body font-semibold text-amber-800">
              Files are temporarily unavailable.
            </p>
            <p className="text-dashboard-metadata text-amber-700 mt-1">
              Please check back shortly or contact support if you need a file link.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-7">
        <SummaryCard
          label="Delivered files"
          value={String(deliveredFiles.length)}
          note="Current delivered versions"
          icon={CheckCircle2}
          iconClassName="text-emerald-600"
        />
        <SummaryCard
          label="Uploaded originals"
          value={String(originalCount)}
          note="Client-uploaded source images"
          icon={UploadCloud}
          iconClassName="text-primary"
        />
        <SummaryCard
          label="Orders with files"
          value={String(orderIdsWithFiles.size)}
          note={`${orders.length} total order${orders.length === 1 ? "" : "s"}`}
          icon={Layers}
          iconClassName="text-secondary-dark"
        />
        <SummaryCard
          label="Available files"
          value={String(totalFileCount)}
          note={totalKnownSize ? `${totalKnownSize} known total size` : "Size shown when available"}
          icon={HardDrive}
          iconClassName="text-blue-600"
        />
      </div>

      {!hasFiles ? (
        <div className="bg-white border border-border rounded-2xl p-8 sm:p-10 shadow-sm text-center mb-7">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/6 border border-primary/10 flex items-center justify-center mb-4">
            <FolderOpen className="w-5 h-5 text-primary" aria-hidden />
          </div>
          <h2 className="text-lg font-bold text-foreground">No files yet</h2>
          <p className="text-dashboard-body text-muted max-w-md mx-auto mt-2">
            Files will appear here after you place an order or receive completed
            deliverables from the PicchuSpot team.
          </p>
          <ClientPortalLink
            href="/dashboard/orders/new"
            className="mt-5 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-dashboard-action font-bold hover:bg-primary-light transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" aria-hidden />
            Place an order
          </ClientPortalLink>
        </div>
      ) : (
        <div className="space-y-7 mb-7">
          <section>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-primary" aria-hidden />
                  <h2 className="text-dashboard-section font-bold text-foreground lg:text-lg">
                    Delivered files
                  </h2>
                </div>
                <p className="mt-1 text-dashboard-body text-muted">
                  Current delivered versions ready to preview or download.
                </p>
              </div>
              <span className="text-dashboard-metadata text-muted-light">
                {deliveredFiles.length} file{deliveredFiles.length === 1 ? "" : "s"}
              </span>
            </div>
            {deliveredFiles.length > 0 ? (
              <ul className="space-y-3">
                {deliveredFiles.map((file) => (
                  <DeliveredFileCard key={file.id} file={file} />
                ))}
              </ul>
            ) : (
              <SectionEmptyState
                title="Delivered files will appear here when your order is completed."
                body="Your uploaded files are available below while the delivered results are still in progress."
              />
            )}
          </section>

          <section>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" aria-hidden />
                  <h2 className="text-dashboard-section font-bold text-foreground lg:text-lg">
                    Uploaded files
                  </h2>
                </div>
                <p className="mt-1 text-dashboard-body text-muted">
                  Original and reference files attached to your orders.
                </p>
              </div>
              <span className="text-dashboard-metadata text-muted-light">
                {uploadedFiles.length} file{uploadedFiles.length === 1 ? "" : "s"}
              </span>
            </div>
            {uploadedFiles.length > 0 ? (
              <ul className="space-y-3">
                {uploadedFiles.map((file) => (
                  <UploadedFileCard key={file.id} file={file} />
                ))}
              </ul>
            ) : (
              <SectionEmptyState
                title="No uploaded source files found."
                body="Delivered files are available above. Source files appear when uploaded file metadata exists for an order."
              />
            )}
          </section>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="w-4 h-4 text-primary" aria-hidden />
            <h3 className="text-dashboard-action font-bold text-foreground">Private file access</h3>
          </div>
          <p className="text-dashboard-body text-muted">
            Download and preview links are generated only when you request them
            and expire shortly after use.
          </p>
        </div>
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <PlusCircle className="w-4 h-4 text-secondary-dark" aria-hidden />
            <h3 className="text-dashboard-action font-bold text-foreground">Need more visuals?</h3>
          </div>
          <p className="text-dashboard-body text-muted mb-3">
            Place a new order and your uploaded files and delivered results will
            appear in this hub.
          </p>
          <ClientPortalLink
            href="/dashboard/orders/new"
            className="inline-flex items-center gap-1.5 text-dashboard-action font-bold text-primary hover:text-primary-light transition-colors"
          >
            Create a new order
            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </ClientPortalLink>
        </div>
      </div>
    </ClientDashboardLayout>
  );
}
