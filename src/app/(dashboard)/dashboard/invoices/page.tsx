import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  PlusCircle,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import { getClientUser } from "@/lib/client-auth";
import {
  getOrdersByClientEmail,
  type ClientOrder,
} from "@/lib/client-orders";
import { formatDate } from "@/lib/display/file-format";
import {
  getBillingStatusLabel,
  getOrderStatusTone,
  type DisplayTone,
} from "@/lib/display/status-labels";
import { getServiceLabel } from "@/lib/display/service-labels";
import { cn, formatUSD } from "@/lib/utils";

export const metadata = {
  title: "Invoices | PicchuSpot Client Portal",
};

const statusToneConfig: Record<
  DisplayTone,
  { className: string; dot: string }
> = {
  amber: {
    className: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-400",
  },
  blue: {
    className: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  green: {
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  purple: {
    className: "bg-purple-50 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
  },
  slate: {
    className: "bg-slate-100 text-slate-500 border-slate-200",
    dot: "bg-slate-400",
  },
};

function formatItemCount(count: number): string {
  return `${count} image${count === 1 ? "" : "s"}`;
}

function StatusPill({ status }: { status: string }) {
  const config = statusToneConfig[getOrderStatusTone(status)];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        config.className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} aria-hidden />
      {getBillingStatusLabel(status)}
    </span>
  );
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
  icon: typeof Receipt;
  iconClassName: string;
}) {
  return (
    <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light mb-1">
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
      <p className="text-[11px] text-muted mt-2">{note}</p>
    </div>
  );
}

function InvoiceOrderCard({ order }: { order: ClientOrder }) {
  return (
    <article className="bg-white border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/6 border border-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4.5 h-4.5 text-primary" aria-hidden />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-foreground text-sm leading-snug">
                {order.order_number}
              </h2>
              <StatusPill status={order.status} />
            </div>
            <p className="text-[13px] text-muted mt-1">
              {getServiceLabel(order.service_type)}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="w-3 h-3" aria-hidden />
                {formatDate(order.created_at)}
              </span>
              <span>{formatItemCount(order.item_count)}</span>
              <span>Updated {formatDate(order.updated_at)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(140px,1fr)_auto_auto] lg:grid-cols-[150px_auto_auto] gap-3 sm:items-center">
          <div className="rounded-lg bg-surface border border-border px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-light">
              Estimated total
            </p>
            <p className="text-sm font-bold text-foreground tabular-nums mt-0.5">
              {formatUSD(order.estimated_total_cents)}
            </p>
          </div>

          <Link
            href={`/dashboard/jobs/${order.id}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-bold text-white hover:bg-primary-light transition-colors"
          >
            View order
            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </Link>

          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Official downloadable invoices will be available here later."
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12px] font-semibold text-muted-light cursor-not-allowed bg-white"
          >
            <Download className="w-3.5 h-3.5" aria-hidden />
            Coming soon
          </button>
        </div>
      </div>
    </article>
  );
}

export default async function DashboardInvoicesPage() {
  const user = await getClientUser();
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const orders = user?.email ? await getOrdersByClientEmail(user.email) : [];
  const totalOrders = orders.length;
  const estimatedTotalCents = orders.reduce(
    (sum, order) => sum + order.estimated_total_cents,
    0,
  );
  const deliveredOrders = orders.filter((order) =>
    ["delivered", "completed"].includes(order.status),
  ).length;
  const pendingOrders = orders.filter((order) =>
    ["pending", "confirmed", "in-progress"].includes(order.status),
  ).length;

  return (
    <ClientDashboardLayout>
      <div className="mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark mb-1.5">
          Client Portal
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
              Invoices
            </h1>
            <p className="text-muted mt-1 text-sm">
              View billing summaries for your PicchuSpot orders.
            </p>
            <p className="text-[12px] text-muted-light mt-1">
              Official downloadable invoices will be available here later.
            </p>
          </div>
          <Link
            href="/order"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors shadow-sm whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" aria-hidden />
            New Order
          </Link>
        </div>
      </div>

      {!user && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Sign in to view billing summaries.
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Your order summaries are loaded from your authenticated client account.
            </p>
          </div>
        </div>
      )}

      {user && !supabaseConfigured && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Billing summaries are temporarily unavailable.
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Please check back shortly or contact support if you need an order summary.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-7">
        <SummaryCard
          label="Total orders"
          value={String(totalOrders)}
          note="All orders in your account"
          icon={Receipt}
          iconClassName="text-primary"
        />
        <SummaryCard
          label="Estimated total"
          value={formatUSD(estimatedTotalCents)}
          note="Based on order summaries"
          icon={FileText}
          iconClassName="text-secondary-dark"
        />
        <SummaryCard
          label="Delivered orders"
          value={String(deliveredOrders)}
          note="Delivered or completed"
          icon={CheckCircle2}
          iconClassName="text-emerald-600"
        />
        <SummaryCard
          label="Pending / in progress"
          value={String(pendingOrders)}
          note="Awaiting completion"
          icon={Clock}
          iconClassName="text-blue-600"
        />
      </div>

      {orders.length > 0 ? (
        <div className="space-y-3 mb-6">
          {orders.map((order) => (
            <InvoiceOrderCard key={order.id} order={order} />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-border rounded-2xl p-8 sm:p-10 shadow-sm text-center mb-6">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/6 border border-primary/10 flex items-center justify-center mb-4">
            <Receipt className="w-5 h-5 text-primary" aria-hidden />
          </div>
          <h2 className="text-lg font-bold text-foreground">No invoices yet</h2>
          <p className="text-sm text-muted leading-relaxed max-w-md mx-auto mt-2">
            Billing summaries will appear here after orders are placed. They are
            read-only summaries for now, not official tax invoices.
          </p>
          <Link
            href="/order"
            className="mt-5 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-light transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" aria-hidden />
            Place an order
          </Link>
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl p-5">
        <p className="text-[13px] font-semibold text-foreground mb-1">
          Billing portal coming later
        </p>
        <p className="text-xs text-muted leading-relaxed">
          This page currently shows read-only order billing summaries. Official
          downloadable invoices, tax details, and payment history will be added
          when the payment system is connected.
        </p>
      </div>
    </ClientDashboardLayout>
  );
}
