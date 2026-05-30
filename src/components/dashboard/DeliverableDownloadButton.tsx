"use client";

// ============================================================
// DeliverableDownloadButton
//
// Calls POST /api/client/deliverables/[id]/download-url,
// receives a short-lived signed URL, then opens it to trigger
// the browser's native file download.
//
// The storage_path never reaches the client — only the signed
// URL (which is itself the temporary credential for one file).
// ============================================================

import { useState } from "react";
import { Download, Loader2, AlertCircle } from "lucide-react";

interface Props {
  deliverableId: string;
  filename: string;
}

export default function DeliverableDownloadButton({ deliverableId, filename }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/client/deliverables/${deliverableId}/download-url`,
        { method: "POST", credentials: "same-origin" }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Could not generate download link.");
      }

      const { signedUrl } = await res.json() as { signedUrl: string };

      // Open in same tab — browser will download because Supabase Storage
      // sets Content-Disposition: attachment for signed download URLs.
      window.location.href = signedUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[12px] font-semibold hover:bg-primary-light transition-colors shadow-sm disabled:opacity-60"
        title={`Download ${filename}`}
      >
        {loading
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />Preparing…</>
          : <><Download className="w-3.5 h-3.5" aria-hidden />Download</>
        }
      </button>
      {error && (
        <p className="flex items-center gap-1 text-[11px] text-red-600">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
