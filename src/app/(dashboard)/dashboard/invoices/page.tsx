import { Receipt, ExternalLink, TrendingUp, PlusCircle } from "lucide-react";
import Link from "next/link";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import { formatUSD } from "@/lib/utils";

export const metadata = {
  title: "Invoices | PicchuSpot Client Portal",
};

const MOCK_INVOICES = [
  {
    id: "inv-001",
    reference: "INV-2025-0041",
    description: "Virtual Staging — Paseo del Mar",
    detail: "4 images · Living Room",
    date: "12 May 2025",
    amountCents: 4900,
    status: "paid" as const,
  },
  {
    id: "inv-002",
    reference: "INV-2025-0032",
    description: "Item Removal & Cleaning — Torrevieja Beach House",
    detail: "7 images",
    date: "7 May 2025",
    amountCents: 2100,
    status: "paid" as const,
  },
  {
    id: "inv-003",
    reference: "INV-2025-0028",
    description: "Virtual Staging — Jávea Finca",
    detail: "3 images · Bedroom",
    date: "30 Apr 2025",
    amountCents: 3600,
    status: "paid" as const,
  },
];

const invoiceStatusConfig = {
  paid: {
    label: "Paid",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-400",
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
} as const;

export default function DashboardInvoicesPage() {
  const totalPaidCents = MOCK_INVOICES.filter((i) => i.status === "paid").reduce(
    (sum, i) => sum + i.amountCents,
    0
  );
  const invoiceCount = MOCK_INVOICES.length;

  return (
    <ClientDashboardLayout>
      {/* Page header */}
      <div className="mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark mb-1.5">
          Client Portal
        </p>
        <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
          Invoices
        </h1>
        <p className="text-muted mt-1 text-sm">
          Your billing history and receipts.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light mb-1">
            Total Spent
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {formatUSD(totalPaidCents)}
          </p>
          <p className="text-[11px] text-muted mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" aria-hidden />
            All-time
          </p>
        </div>
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light mb-1">
            Invoices
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {invoiceCount}
          </p>
          <p className="text-[11px] text-muted mt-1">
            {invoiceCount} paid · 0 outstanding
          </p>
        </div>
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-light mb-1">
            Outstanding
          </p>
          <p className="text-2xl font-bold text-emerald-600 tabular-nums">
            {formatUSD(0)}
          </p>
          <p className="text-[11px] text-emerald-600 mt-1 font-medium">
            All paid ✓
          </p>
        </div>
      </div>

      {/* Invoices list */}
      <div className="space-y-2.5 mb-6">
        {MOCK_INVOICES.map((inv) => {
          const sc = invoiceStatusConfig[inv.status];
          return (
            <div
              key={inv.id}
              className="bg-white border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm hover:shadow-md transition-all duration-200"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-primary/6 border border-primary/10 flex items-center justify-center flex-shrink-0">
                <Receipt className="w-4.5 h-4.5 text-primary" aria-hidden />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-[13px] leading-snug">
                  {inv.description}
                </p>
                <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1">
                  <span className="text-[10px] text-muted font-mono bg-surface px-1.5 py-0.5 rounded">
                    {inv.reference}
                  </span>
                  <span className="text-[11px] text-muted">{inv.detail}</span>
                  <span className="text-[11px] text-muted">{inv.date}</span>
                </div>
              </div>

              {/* Right side: status + amount + receipt */}
              <div className="flex items-center gap-3 flex-shrink-0 flex-wrap sm:flex-nowrap">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${sc.className}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} aria-hidden />
                  {sc.label}
                </span>
                <span className="font-bold text-foreground tabular-nums text-[13px] min-w-[60px] text-right">
                  {formatUSD(inv.amountCents)}
                </span>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[11px] font-semibold text-muted-light cursor-not-allowed select-none"
                  title="Receipt PDF download coming when payment system is connected"
                >
                  <ExternalLink className="w-3 h-3" aria-hidden />
                  Receipt
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom info + CTA row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-[13px] font-semibold text-foreground mb-1">Full billing portal coming soon</p>
          <p className="text-xs text-muted leading-relaxed">
            Automated invoice generation, receipt PDFs, and payment history will be
            available when the payment system is connected.
          </p>
        </div>
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <p className="text-[13px] font-semibold text-foreground mb-1">Need to place a new order?</p>
          <p className="text-xs text-muted leading-relaxed mb-3">
            All services are billed per order at checkout.
          </p>
          <Link
            href="/order"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-primary hover:text-primary-light transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" aria-hidden />
            Create a new order →
          </Link>
        </div>
      </div>
    </ClientDashboardLayout>
  );
}
