"use client";

import { useState } from "react";
import { AlertCircle, Download, Loader2 } from "lucide-react";

interface BulkDownloadFile {
  signedUrl: string;
  filename: string;
}

interface BulkDownloadResponse {
  ok: true;
  mode: "signed-url-batch";
  archiveFilename: string;
  files: BulkDownloadFile[];
}

interface Props {
  endpoint: string;
  disabled?: boolean;
  label?: string;
  emptyLabel?: string;
  className?: string;
}

export default function BulkDownloadButton({
  endpoint,
  disabled = false,
  label = "Download all",
  emptyLabel = "No files",
  className = "",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (loading || disabled) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not prepare downloads.");
      }

      const payload = (await res.json()) as BulkDownloadResponse;
      if (!payload.files?.length) {
        throw new Error("No files are available to download.");
      }

      payload.files.forEach((file, index) => {
        window.setTimeout(() => {
          const a = document.createElement("a");
          a.href = file.signedUrl;
          a.download = file.filename;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
        }, index * 300);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk download failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading || disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-[11px] font-semibold text-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={disabled ? emptyLabel : label}
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Preparing...
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" aria-hidden />
            {disabled ? emptyLabel : label}
          </>
        )}
      </button>
      {error && (
        <p className="flex items-center gap-1 text-[11px] text-red-600 text-right max-w-[220px]">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden />
          {error}
        </p>
      )}
      {!disabled && (
        <p className="text-[10px] text-muted-light text-right">
          Downloads files one by one.
        </p>
      )}
    </div>
  );
}
