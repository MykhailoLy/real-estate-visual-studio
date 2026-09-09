import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createServerClient } from "@/lib/supabase";
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
  reference_file_count: number;
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
          Omit<ReworkRow, "filename" | "reference_file_count"> & {
            order_deliverables: { filename: string };
          }
        >).map((r) => ({
          ...r,
          filename: r.order_deliverables?.filename ?? null,
          reference_file_count: 0,
          order_deliverables: undefined,
        })) as unknown as ReworkRow[];

        if (rows.length > 0) {
          const { data: referenceRows, error: referenceErr } = await supabase
            .from("deliverable_review_files")
            .select("review_id")
            .in("review_id", rows.map((row) => row.id))
            .eq("upload_status", "uploaded");

          if (referenceErr) {
            console.error(
              "[admin/rework] Reference file count lookup:",
              referenceErr.message,
            );
          } else {
            const counts = new Map<string, number>();
            for (const file of referenceRows ?? []) {
              const reviewId = String(file.review_id);
              counts.set(reviewId, (counts.get(reviewId) ?? 0) + 1);
            }
            rows = rows.map((row) => ({
              ...row,
              reference_file_count: counts.get(row.id) ?? 0,
            }));
          }
        }
      }
    } catch (err) {
      dbError = String(err);
    }
  }

  return (
    <div>
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
  );
}
