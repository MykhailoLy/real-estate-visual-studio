"use client";

import { useState } from "react";
import { AlertCircle, Download, Loader2 } from "lucide-react";

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

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filenameFromDisposition(res.headers.get("Content-Disposition"));
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-[11px] font-semibold text-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed [[data-dashboard-scroll-container]_&]:text-dashboard-action"
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
        <p className="flex items-center gap-1 text-[11px] text-red-600 text-right max-w-[220px] [[data-dashboard-scroll-container]_&]:text-dashboard-metadata">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden />
          {error}
        </p>
      )}
      {!disabled && (
        <p className="text-[10px] text-muted-light text-right [[data-dashboard-scroll-container]_&]:text-dashboard-metadata">
          Downloads as ZIP.
        </p>
      )}
    </div>
  );
}

function filenameFromDisposition(disposition: string | null): string {
  if (!disposition) return "files.zip";

  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }

  const asciiMatch = /filename="?([^";]+)"?/i.exec(disposition);
  return asciiMatch?.[1] ?? "files.zip";
}
