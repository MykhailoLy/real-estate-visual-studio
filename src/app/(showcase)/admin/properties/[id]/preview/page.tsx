import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { serializePublicPropertyShowcase } from "@/features/property-showcase/public-serialization";
import { getPropertyShowcaseForAdminById } from "@/features/property-showcase/server";
import PropertyShowcaseView from "../../../../property/PropertyShowcaseView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminPropertyPreviewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const metadata: Metadata = {
  title: "Property Draft Preview",
  robots: { index: false, follow: false },
};

export default async function AdminPropertyPreviewPage({
  params,
}: AdminPropertyPreviewPageProps) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const record = await getPropertyShowcaseForAdminById(id);

  if (!record) {
    notFound();
  }

  return (
    <>
      <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/properties"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-[#0f2440] transition hover:border-[#0f2440]/40"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to properties
          </Link>
          <p className="min-w-0 break-words text-sm font-semibold text-slate-600">
            Draft preview: {record.property.title.en}
          </p>
        </div>
      </div>
      <PropertyShowcaseView property={serializePublicPropertyShowcase(record.property)} />
    </>
  );
}
