import type { Metadata } from "next";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import ClientDraftsPage from "@/components/dashboard/ClientDraftsPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Drafts | PicchuSpot Client Portal",
  robots: { index: false, follow: false },
};

export default function DraftsPage() {
  return (
    <ClientDashboardLayout>
      <ClientDraftsPage />
    </ClientDashboardLayout>
  );
}
