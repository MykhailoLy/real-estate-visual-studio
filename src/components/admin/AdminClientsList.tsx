import type { AdminClientRow } from "@/lib/admin-clients-server";
import AdminPartnerPricingControl from "./AdminPartnerPricingControl";

function joinedDate(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export default function AdminClientsList({ clients }: { clients: AdminClientRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div aria-hidden="true" className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_8rem_minmax(14rem,1.5fr)] gap-4 border-b border-border px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted lg:grid">
        <span>Name / Email</span><span>Company</span><span>Joined</span><span>Partner</span>
      </div>
      <ul aria-label="Registered clients" className="divide-y divide-border">
        {clients.map((client) => (
          <li key={client.userId} className="grid min-w-0 grid-cols-1 gap-3 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_8rem_minmax(14rem,1.5fr)] lg:gap-4 lg:px-5">
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-foreground">{client.name ?? "Name not provided"}</p>
              <p className="mt-1 break-all text-sm text-muted">{client.email ?? "Email not provided"}</p>
            </div>
            <p className="min-w-0 break-words text-sm text-muted">
              <span className="lg:hidden">Company: </span>{client.company ?? "—"}
            </p>
            <p className="text-sm text-muted"><span className="lg:hidden">Joined </span>{joinedDate(client.joined)}</p>
            <fieldset className="min-w-0 border-0 p-0" aria-label={`Partner pricing for ${client.email ?? client.name ?? client.userId}`}>
              {client.partnerClient === null ? (
                <p role="status" className="text-sm text-muted">Partner status unavailable. Reload to retry.</p>
              ) : (
                <AdminPartnerPricingControl key={`${client.userId}:${client.partnerClient}`} userId={client.userId} partnerClient={client.partnerClient} compact />
              )}
            </fieldset>
          </li>
        ))}
      </ul>
    </div>
  );
}
