"use client";

// ============================================================
// DeliverableDownloadButton
//
// Calls POST /api/client/deliverables/[id]/download-url,
// receives a short-lived signed URL, then triggers a real file
// download via a temporary <a> element with the `download`
// attribute — this forces browsers to save the file instead of
// opening it in a tab.
//
// Two layers of force-download:
//   1. Server: createSignedUrl(..., { download: filename }) sets
//      Content-Disposition: attachment on the Storage response.
//   2. Client: <a download="filename"> instructs the browser to
//      treat the response as a download regardless of MIME type.
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

      const { signedUrl, filename: dlFilename } =
        await res.json() as { signedUrl: string; filename: string };

      // Force download via a temporary <a> element.
      // The `download` attribute tells the browser to save the file
      // with the given name instead of navigating to it.
      // Combined with Content-Disposition: attachment from the server,
      // this works reliably across Chrome, Firefox, Safari, and Edge.
      const a = document.createElement("a");
      a.href = signedUrl;
      a.download = dlFilename ?? filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
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
          : <><Download className="w-3.5 h-3.5" aria-hidden />Download file</>
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
