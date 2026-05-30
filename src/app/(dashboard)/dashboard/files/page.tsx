import { FolderOpen, Download, ImageIcon, FileText } from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";

export const metadata = {
  title: "Files | PicchuSpot Client Portal",
};

// Mock delivered file cards — placeholder only, no storage logic
const MOCK_FILE_GROUPS = [
  {
    id: "fg-001",
    jobTitle: "Paseo del Mar — Living Room Staging",
    reference: "VS-2025-0041",
    deliveredDate: "12 May 2025",
    fileCount: 4,
    fileType: "image" as const,
  },
  {
    id: "fg-002",
    jobTitle: "Jávea Finca — Bedroom Staging",
    reference: "VS-2025-0028",
    deliveredDate: "30 Apr 2025",
    fileCount: 3,
    fileType: "image" as const,
  },
  {
    id: "fg-003",
    jobTitle: "Torrevieja Beach House — Item Removal",
    reference: "IR-2025-0032",
    deliveredDate: "7 May 2025",
    fileCount: 7,
    fileType: "image" as const,
  },
];

export default function DashboardFilesPage() {
  return (
    <ClientDashboardLayout>
      {/* Page header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary-dark mb-1">
          Client Portal
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary leading-tight">
          Delivered Files
        </h1>
        <p className="text-muted mt-1 text-sm">
          Download your completed visuals here.
        </p>
      </div>

      {MOCK_FILE_GROUPS.length > 0 ? (
        <div className="space-y-4">
          {MOCK_FILE_GROUPS.map((group) => (
            <div
              key={group.id}
              className="bg-white border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                  {group.fileType === "image" ? (
                    <ImageIcon className="w-5 h-5 text-primary" aria-hidden />
                  ) : (
                    <FileText className="w-5 h-5 text-primary" aria-hidden />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm leading-snug">
                    {group.jobTitle}
                  </p>
                  <p className="text-[11px] text-muted font-mono mt-0.5">
                    {group.reference}
                  </p>
                  <p className="text-[11px] text-muted mt-1">
                    {group.fileCount} file{group.fileCount !== 1 ? "s" : ""} ·
                    Delivered {group.deliveredDate}
                  </p>
                </div>
              </div>
              {/* Download button — placeholder */}
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-semibold text-muted cursor-not-allowed opacity-60 flex-shrink-0"
                title="Download will be available when storage is connected"
              >
                <Download className="w-4 h-4" aria-hidden />
                Download
              </button>
            </div>
          ))}

          {/* Info banner */}
          <div className="bg-surface border border-border rounded-xl p-5 flex items-start gap-3">
            <FolderOpen
              className="w-5 h-5 text-muted flex-shrink-0 mt-0.5"
              aria-hidden
            />
            <div>
              <p className="text-sm font-semibold text-foreground">
                File storage coming soon
              </p>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">
                Download links will be active once file delivery is connected.
                For now, files are delivered via the email you provided at
                checkout.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-5">
            <FolderOpen className="w-7 h-7 text-muted-light" aria-hidden />
          </div>
          <h2 className="text-base font-semibold text-foreground mb-2">
            No delivered files yet
          </h2>
          <p className="text-sm text-muted max-w-sm">
            Delivered files will appear here once your orders are completed.
            Files are also sent to your email.
          </p>
        </div>
      )}
    </ClientDashboardLayout>
  );
}
