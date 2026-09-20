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

type AdminPropertyMediaPageProps = {
  searchParams: Promise<{
    property?: string;
  }>;
};

export default async function AdminPropertyMediaPage({
  searchParams,
}: AdminPropertyMediaPageProps) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const { property } = await searchParams;
  const result = await getPropertyShowcasesForAdmin();

  return (
    <OptimizedPropertyMediaManagerClient
      records={result.records}
      schemaReady={result.schemaReady}
      initialPropertyId={property ?? ""}
    />
  );
}
