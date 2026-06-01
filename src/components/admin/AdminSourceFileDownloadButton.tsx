"use client";

import { useState } from "react";
import { AlertCircle, Download, Loader2 } from "lucide-react";

interface Props {
  orderId: string;
  fileId: string;
  filename: string;
}

export default function AdminSourceFileDownloadButton({
  orderId,
  fileId,
  filename,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/orders/${orderId}/source-files/${fileId}/download-url`,
        { method: "POST", credentials: "same-origin" }
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not generate download link.");
      }

      const { signedUrl, filename: downloadFilename } = (await res.json()) as {
        ok: true;
        signedUrl: string;
        filename: string;
      };

      const a = document.createElement("a");
      a.href = signedUrl;
      a.download = downloadFilename || filename;
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
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-[12px] font-semibold hover:bg-primary-light transition-colors shadow-sm disabled:opacity-60"
        title={`Download ${filename}`}
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Preparing...
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" aria-hidden />
            Download
          </>
        )}
      </button>
      {error && (
        <p className="flex items-center gap-1 text-[11px] text-red-600 text-right">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
