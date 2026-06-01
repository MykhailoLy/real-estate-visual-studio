import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import AdminReworkList from "@/components/admin/AdminReworkList";

export const dynamic  = "force-dynamic";
export const runtime  = "nodejs";

export const metadata: Metadata = {
  title:  "Rework Queue — Admin | PicchuSpot",
  robots: { index: false, follow: false },
};

export interface ReworkRow {
  id: string;
  deliverable_id: string;
  order_id: string;
  order_number: string;
  item_index: number | null;
  client_email: string;
  status: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
  filename: string | null;
}

export default async function AdminReworkPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  let rows: ReworkRow[] = [];
  let dbError: string | null = null;

  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (configured) {
    try {
      const supabase = createServerClient();

      // Fetch active rework reviews with deliverable filename via JOIN.
      const { data, error } = await supabase
        .from("deliverable_reviews")
        .select(
          "id, deliverable_id, order_id, order_number, item_index, " +
          "client_email, status, comment, created_at, updated_at, " +
          "order_deliverables!deliverable_reviews_deliverable_id_fkey(filename)"
        )
        .in("status", ["rework_requested", "rework_in_progress"])
        .order("created_at", { ascending: false });

      if (error) {
        dbError = error.message;
      } else {
        rows = ((data ?? []) as unknown as Array<
          Omit<ReworkRow, "filename"> & { order_deliverables: { filename: string } }
        >).map((r) => ({
          ...r,
          filename: r.order_deliverables?.filename ?? null,
          order_deliverables: undefined,
        })) as unknown as ReworkRow[];
      }
    } catch (err) {
      dbError = String(err);
    }
  }

  return (
    <section className="bg-surface min-h-screen py-10 lg:py-14">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10">

        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6 lg:mb-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-2">
              PicchuSpot Admin
            </p>
            <h1 className="text-3xl lg:text-4xl font-bold text-primary tracking-tight">
              Rework Queue
            </h1>
            <p className="mt-1 text-sm text-muted">
              Active rework requests from clients
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden />
              Orders
            </Link>
            <AdminLogoutButton />
          </div>
        </header>

        {!configured && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
            Supabase is not configured.
          </div>
        )}
        {dbError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
            DB error: {dbError}
          </div>
        )}

        {rows.length === 0 && !dbError ? (
          <div className="bg-white border border-border rounded-xl shadow-sm p-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center mb-4">
              <RotateCcw className="w-5 h-5 text-muted-light" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">
              No active rework requests
            </p>
            <p className="text-xs text-muted max-w-xs leading-relaxed">
              When a client requests changes to a delivered file, it will appear here.
            </p>
          </div>
        ) : (
          <AdminReworkList initialRows={rows} />
        )}
      </div>
    </section>
  );
}
