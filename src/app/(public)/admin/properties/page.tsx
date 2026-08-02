import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
    <PropertiesAdminClient
      records={result.records}
      supabaseConfigured={isPropertyShowcaseSupabaseConfigured()}
      schemaReady={result.schemaReady}
    />
  );
}
