import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  getPropertyShowcaseForAdminById,
  isPropertyShowcaseSupabaseConfigured,
} from "@/features/property-showcase/server";
import { getPropertyAnalyticsForAdmin } from "@/features/property-showcase/property-analytics-server";
import PropertyAnalyticsDashboard from "./PropertyAnalyticsDashboard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Property Showcase Analytics",
  robots: { index: false, follow: false },
};

type PropertyAnalyticsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
};

export default async function PropertyAnalyticsPage({
  params,
  searchParams,
}: PropertyAnalyticsPageProps) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  if (!isPropertyShowcaseSupabaseConfigured()) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm">
        Property analytics is not configured yet.
      </div>
    );
  }

  const [{ id }, { period }] = await Promise.all([params, searchParams]);
  const record = await getPropertyShowcaseForAdminById(id);
  if (!record) notFound();

  const analytics = await getPropertyAnalyticsForAdmin({
    propertyId: record.id,
    period,
  });

  return <PropertyAnalyticsDashboard record={record} analytics={analytics} />;
}
