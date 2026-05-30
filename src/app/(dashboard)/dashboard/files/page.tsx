import Link from "next/link";
import { FolderOpen, Download, ImageIcon, PlusCircle, Mail } from "lucide-react";
import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";

export const metadata = {
  title: "Files | PicchuSpot Client Portal",
};

// Mock delivered file groups — no real storage connected yet
const MOCK_FILE_GROUPS = [
  {
    id: "fg-001",
    jobTitle: "Paseo del Mar — Living Room Staging",
    reference: "VS-2025-0041",
    deliveredDate: "12 May 2025",
    fileCount: 4,
    sizeMb: "18.4 MB",
    fileType: "image" as const,
  },
  {
    id: "fg-002",
    jobTitle: "Jávea Finca — Bedroom Staging",
    reference: "VS-2025-0028",
    deliveredDate: "30 Apr 2025",
    fileCount: 3,
    sizeMb: "12.1 MB",
    fileType: "image" as const,
  },
  {
    id: "fg-003",
    jobTitle: "Torrevieja Beach House — Item Removal",
    reference: "IR-2025-0032",
    deliveredDate: "7 May 2025",
    fileCount: 7,
    sizeMb: "31.6 MB",
    fileType: "image" as const,
  },
];

export default function DashboardFilesPage() {
  return (
    <ClientDashboardLayout>
      {/* Page header */}
      <div className="mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary-dark mb-1.5">
          Client Portal
        </p>
        <h1 className="text-2xl sm:text-[28px] font-bold text-primary leading-tight">
          Delivered Files
        </h1>
        <p className="text-muted mt-1 text-sm">
          Download your completed visuals. Files are also sent to your email.
        </p>
      </div>

      {/* File delivery notice banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200/60 rounded-xl p-4 mb-6">
        <Mail className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-[13px] font-semibold text-blue-800">Files are delivered by email</p>
          <p className="text-xs text-blue-700/80 mt-0.5 leading-relaxed">
            All completed files are sent to <strong>demo@picchuspot.com</strong> as soon as they&rsquo;re ready.
            In-portal download links will be enabled when file storage is connected.
          </p>
        </div>
      </div>

      {/* File cards */}
      <div className="space-y-3 mb-6">
        {MOCK_FILE_GROUPS.map((group) => (
          <div
            key={group.id}
            className="bg-white border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm hover:shadow-md transition-all duration-200 group"
          >
            <div className="flex items-center gap-4">
              {/* File type icon */}
              <div className="w-11 h-11 rounded-xl bg-primary/6 border border-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                <ImageIcon className="w-5 h-5 text-primary" aria-hidden />
              </div>
              <div>
                <p className="font-semibold text-foreground text-[13px] leading-snug">
                  {group.jobTitle}
                </p>
                <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1">
                  <span className="text-[10px] text-muted font-mono bg-surface px-1.5 py-0.5 rounded">
                    {group.reference}
                  </span>
                  <span className="text-[11px] text-muted">
                    {group.fileCount} file{group.fileCount !== 1 ? "s" : ""} · {group.sizeMb}
                  </span>
                  <span className="text-[11px] text-muted">
                    Delivered {group.deliveredDate}
                  </span>
                </div>
              </div>
            </div>

            {/* Download button — intentionally disabled, storage not connected */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-[11px] text-muted-light hidden sm:inline">
                Download coming soon
              </span>
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-[12px] font-semibold text-muted-light cursor-not-allowed select-none"
                title="In-portal downloads will be available when file storage is connected"
              >
                <Download className="w-3.5 h-3.5" aria-hidden />
                Download
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA + explanation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="w-4 h-4 text-primary" aria-hidden />
            <h3 className="text-sm font-bold text-foreground">About your files</h3>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            We deliver high-resolution JPEG files (min. 3000px on the long edge) unless
            otherwise specified. Final files are watermark-free and ready for MLS, print,
            or digital marketing use.
          </p>
        </div>
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <PlusCircle className="w-4 h-4 text-secondary-dark" aria-hidden />
            <h3 className="text-sm font-bold text-foreground">Need more visuals?</h3>
          </div>
          <p className="text-xs text-muted leading-relaxed mb-3">
            Place a new order and we&rsquo;ll have your completed visuals ready within 24–48 hours.
          </p>
          <Link
            href="/order"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-primary hover:text-primary-light transition-colors"
          >
            Create a new order →
          </Link>
        </div>
      </div>
    </ClientDashboardLayout>
  );
}
