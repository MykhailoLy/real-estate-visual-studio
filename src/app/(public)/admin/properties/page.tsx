import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Images } from "lucide-react";
import PropertiesAdminClient from "./PropertiesAdminClient";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  getPropertyShowcasesForAdmin,
  isPropertyShowcaseSupabaseConfigured,
} from "@/features/property-showcase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Property Showcases Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPropertiesPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const result = await getPropertyShowcasesForAdmin();

  return (
    <>
      <div className="mb-5 flex justify-end">
        <Link
          href="/admin/properties/media"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-bold text-primary shadow-sm transition hover:border-primary/40"
        >
          <Images className="h-4 w-4" aria-hidden />
          Manage photos & floor plans
        </Link>
      </div>
      <PropertiesAdminClient
        records={result.records}
        supabaseConfigured={isPropertyShowcaseSupabaseConfigured()}
        schemaReady={result.schemaReady}
      />
    </>
  );
}
