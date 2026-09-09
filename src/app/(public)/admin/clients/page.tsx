import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminClientsList from "@/components/admin/AdminClientsList";
import { AdminClientsError, listAdminClients, parseAdminClientsPage, type AdminClientsPageData } from "@/lib/admin-clients-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata: Metadata = {
  title: "Clients Admin | PicchuSpot",
  robots: { index: false, follow: false },
};

export default async function AdminClientsPage({ searchParams }: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const page = parseAdminClientsPage((await searchParams).page);
  let result: AdminClientsPageData | null = null;
  try {
    result = await listAdminClients(page);
  } catch (error) {
    if (error instanceof AdminClientsError && error.status === 401) redirect("/admin/login");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-primary">Clients</h1>
        <p className="mt-2 text-sm text-muted">Manage registered accounts and Partner pricing.</p>
        <p className="mt-1 text-sm text-muted">Accounts can receive Partner pricing before their first order.</p>
      </div>
      {!result ? (
        <div role="alert" className="rounded-xl border border-border bg-white p-5 text-sm text-foreground">
          Registered clients could not be loaded. <Link href={`/admin/clients?page=${page}`} className="font-semibold text-primary underline">Retry</Link>
        </div>
      ) : (
        <>
          {result.profilesUnavailable && <p role="status" className="text-sm text-muted">Profile details are unavailable. Account information is shown where available.</p>}
          {result.pricingUnavailable && <p role="alert" className="text-sm text-muted">Partner status could not be verified. Controls are unavailable until you reload successfully.</p>}
          {result.clients.length > 0 ? <AdminClientsList clients={result.clients} /> : (
            <p className="rounded-xl border border-border bg-white p-5 text-sm text-muted">No registered clients on this page.</p>
          )}
          <nav aria-label="Client pages" className="flex flex-wrap items-center gap-4 text-sm">
            {page > 1 && <Link href="/admin/clients" className="font-semibold text-primary underline">Newest accounts</Link>}
            {page > 1 && <Link href={`/admin/clients?page=${page - 1}`} className="font-semibold text-primary underline">Previous</Link>}
            <span className="text-muted">Page {page} · Up to 50 accounts</span>
            {result.hasNextPage && <Link href={`/admin/clients?page=${page + 1}`} className="font-semibold text-primary underline">Next</Link>}
          </nav>
        </>
      )}
    </div>
  );
}
