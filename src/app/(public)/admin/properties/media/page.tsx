import type { Metadata } from "next";
import { redirect } from "next/navigation";
import OptimizedPropertyMediaManagerClient from "./OptimizedPropertyMediaManagerClient";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getPropertyShowcasesForAdmin } from "@/features/property-showcase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Property Media Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPropertyMediaPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const result = await getPropertyShowcasesForAdmin();

  return (
    <OptimizedPropertyMediaManagerClient
      records={result.records}
      schemaReady={result.schemaReady}
    />
  );
}
