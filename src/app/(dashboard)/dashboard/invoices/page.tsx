import { Receipt, ExternalLink, Clock } from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import { formatUSD } from "@/lib/utils";

export const metadata = {
  title: "Invoices | PicchuSpot Client Portal",
};

// Mock invoice data — placeholder only, no payment logic
const MOCK_INVOICES = [
  {
    id: "inv-001",
    reference: "INV-2025-0041",
    description: "Virtual Staging — Paseo del Mar (4 images)",
    date: "12 May 2025",
    amountCents: 4900,
    status: "paid" as const,
  },
  {
    id: "inv-002",
    reference: "INV-2025-0032",
    description: "Item Removal & Cleaning — Torrevieja Beach House (7 images)",
    date: "7 May 2025",
    amountCents: 2100,
    status: "paid" as const,
  },
  {
    id: "inv-003",
    reference: "INV-2025-0028",
    description: "Virtual Staging — Jávea Finca Bedroom (3 images)",
    date: "30 Apr 2025",
    amountCents: 3600,
    status: "paid" as const,
  },
];

const invoiceStatusStyle = {
  paid: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  overdue: "bg-red-50 text-red-700 border border-red-200",
} as const;

const invoiceStatusLabel = {
  paid: "Paid",
  pending: "Pending",
  overdue: "Overdue",
} as const;

export default function DashboardInvoicesPage() {
  const totalPaid = MOCK_INVOICES.filter((i) => i.status === "paid").reduce(
    (sum, i) => sum + i.amountCents,
    0
  );

  return (
    <ClientDashboardLayout>
      {/* Page header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary-dark mb-1">
          Client Portal
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary leading-tight">
          Invoices
        </h1>
        <p className="text-muted mt-1 text-sm">
          Your billing history and receipts.
        </p>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted mb-1">
            Total Spent
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {formatUSD(totalPaid)}
          </p>
        </div>
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted mb-1">
            Invoices
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {MOCK_INVOICES.length}
          </p>
        </div>
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted mb-1">
            Outstanding
          </p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {formatUSD(0)}
          </p>
        </div>
      </div>

      {/* Invoices list */}
      {MOCK_INVOICES.length > 0 ? (
        <div className="space-y-3">
          {MOCK_INVOICES.map((inv) => (
            <div
              key={inv.id}
              className="bg-white border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-5 h-5 text-primary" aria-hidden />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm leading-snug">
                    {inv.description}
                  </p>
                  <p className="text-[11px] text-muted font-mono mt-0.5">
                    {inv.reference}
                  </p>
                  <p className="text-[11px] text-muted mt-1">{inv.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${invoiceStatusStyle[inv.status]}`}
                >
                  {invoiceStatusLabel[inv.status]}
                </span>
                <span className="font-bold text-foreground tabular-nums text-sm">
                  {formatUSD(inv.amountCents)}
                </span>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-[12px] font-semibold text-muted cursor-not-allowed opacity-60"
                  title="Receipt download coming soon"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                  Receipt
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-5">
            <Clock className="w-7 h-7 text-muted-light" aria-hidden />
          </div>
          <h2 className="text-base font-semibold text-foreground mb-2">
            No invoices yet
          </h2>
          <p className="text-sm text-muted max-w-sm">
            Invoices and receipts will appear here once you place and pay for
            your first order.
          </p>
        </div>
      )}

      {/* Coming soon notice */}
      <div className="mt-6 bg-surface border border-border rounded-xl p-5 flex items-start gap-3">
        <Receipt className="w-5 h-5 text-muted flex-shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-foreground">
            Full billing portal coming soon
          </p>
          <p className="text-xs text-muted mt-0.5 leading-relaxed">
            Automated invoicing and receipt downloads will be available when the
            payment system is connected.
          </p>
        </div>
      </div>
    </ClientDashboardLayout>
  );
}
