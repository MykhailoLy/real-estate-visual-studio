"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, Download, FileArchive, FileText, ImageIcon, Loader2, X } from "lucide-react";
import {
  getFilePreviewKind,
  getFileTypeLabel,
  type FilePreviewKind,
} from "@/lib/file-preview";
import { useViewerScrollLock } from "@/components/media/useViewerScrollLock";
import { NativeStaticImageStage } from "@/components/media/StaticImageStage";
import type { StaticImageViewerVariant } from "@/components/media/static-image-variant";

interface Props {
  viewerVariant: StaticImageViewerVariant;
  filename: string;
  mimeType?: string | null;
  fileSizeLabel?: string | null;
  badgeLabel?: string;
  meta?: ReactNode;
  signedUrlEndpoint: string;
  downloadLabel?: string;
  actions?: ReactNode;
  presentation?: "default" | "feature";
  mediaAspectRatio?: number | null;
  onImageAspectRatio?: (aspectRatio: number) => void;
}

type SignedUrlResponse = {
  ok?: boolean;
  signedUrl: string;
  filename: string;
};

export default function FilePreviewCard({
  viewerVariant,
  filename,
  mimeType = null,
  fileSizeLabel = null,
  badgeLabel,
  meta,
  signedUrlEndpoint,
  downloadLabel = "Download",
  actions,
  presentation = "default",
  mediaAspectRatio = null,
  onImageAspectRatio,
}: Props) {
  const previewKind = getFilePreviewKind(filename, mimeType);
  const typeLabel = getFileTypeLabel(filename, mimeType);
  const previewable = previewKind !== "unsupported";

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useViewerScrollLock(modalOpen);

  useEffect(() => {
    if (previewKind !== "image" || previewUrl || previewLoading) return;
    void loadPreviewUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKind]);

  async function requestSignedUrl(intent: "preview" | "download") {
    const res = await fetch(signedUrlEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ intent }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Could not generate file link.");
    }

    return (await res.json()) as SignedUrlResponse;
  }

  async function loadPreviewUrl(): Promise<string | null> {
    if (!previewable) return null;
    if (previewUrl) return previewUrl;

    setPreviewLoading(true);
    setError(null);
    try {
      const data = await requestSignedUrl("preview");
      setPreviewUrl(data.signedUrl);
      return data.signedUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
      return null;
    } finally {
      setPreviewLoading(false);
    }
  }

  async function openPreview() {
    if (!previewable) return;
    const url = await loadPreviewUrl();
    if (url) setModalOpen(true);
  }

  async function handleDownload() {
    if (downloadLoading) return;
    setDownloadLoading(true);
    setError(null);

    try {
      const data = await requestSignedUrl("download");
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = data.filename || filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDownloadLoading(false);
    }
  }

  const featureMediaStyle =
    presentation === "feature" && mediaAspectRatio && mediaAspectRatio > 0
      ? { aspectRatio: mediaAspectRatio }
      : undefined;

  const previewSurface = (
    <PreviewSurface
      kind={previewKind}
      filename={filename}
      previewUrl={previewUrl}
      loading={previewLoading}
      fit={presentation === "feature" ? "contain" : "cover"}
      onImageAspectRatio={onImageAspectRatio}
    />
  );

  if (presentation === "feature") {
    return (
      <div className="w-full min-w-0">
        <button
          type="button"
          onClick={openPreview}
          disabled={!previewable}
          className={[
            "relative flex w-full aspect-[4/3] overflow-hidden rounded-lg border border-border bg-surface",
            previewable
              ? "cursor-pointer transition-colors hover:border-primary/50"
              : "cursor-default",
          ].join(" ")}
          style={featureMediaStyle}
          title={previewable ? `Preview ${filename}` : "Preview not available"}
        >
          {previewSurface}
        </button>

        <div className="mt-3 min-w-0">
          <button
            type="button"
            onClick={openPreview}
            disabled={!previewable}
            className={[
              "block max-w-full break-words text-left text-[13px] font-semibold leading-snug text-foreground",
              previewable ? "transition-colors hover:text-primary" : "cursor-default",
            ].join(" ")}
            title={filename}
          >
            {filename}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {badgeLabel && (
              <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/8 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {badgeLabel}
              </span>
            )}
            {fileSizeLabel && <span className="text-[11px] text-muted">{fileSizeLabel}</span>}
            <span className="text-[11px] font-semibold text-foreground/70">{typeLabel}</span>
            {!previewable && <span className="text-[11px] text-muted">Preview not available</span>}
          </div>
          {meta && <div className="mt-2">{meta}</div>}
          {error && (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-red-600">
              <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden />
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloadLoading}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-primary-light disabled:opacity-60"
            title={`Download ${filename}`}
          >
            {downloadLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Preparing...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" aria-hidden />
                {downloadLabel}
              </>
            )}
          </button>
          {actions && <div className="mt-4 border-t border-border pt-4">{actions}</div>}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
        <button
          type="button"
          onClick={openPreview}
          disabled={!previewable}
          className={[
            "relative w-full sm:w-28 h-24 rounded-lg border border-border bg-surface overflow-hidden flex-shrink-0",
            previewable ? "cursor-pointer hover:border-primary/50 transition-colors" : "cursor-default",
          ].join(" ")}
          title={previewable ? `Preview ${filename}` : "Preview not available"}
        >
          {previewSurface}
        </button>

        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={openPreview}
            disabled={!previewable}
            className={[
              "block text-left text-[13px] font-semibold text-foreground truncate",
              previewable ? "hover:text-primary transition-colors" : "cursor-default",
            ].join(" ")}
            title={filename}
          >
            {filename}
          </button>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1">
            {badgeLabel && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-primary/15 bg-primary/8 text-[10px] font-semibold text-primary">
                {badgeLabel}
              </span>
            )}
            {fileSizeLabel && (
              <span className="text-[11px] text-muted">{fileSizeLabel}</span>
            )}
            <span className="text-[11px] font-semibold text-foreground/70">
              {typeLabel}
            </span>
            {!previewable && (
              <span className="text-[11px] text-muted">Preview not available</span>
            )}
          </div>
          {meta && <div className="mt-1">{meta}</div>}
          {error && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600">
              <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden />
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-row sm:flex-col items-start sm:items-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloadLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-[12px] font-semibold hover:bg-primary-light transition-colors shadow-sm disabled:opacity-60"
            title={`Download ${filename}`}
          >
            {downloadLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                Preparing...
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" aria-hidden />
                {downloadLabel}
              </>
            )}
          </button>
          {actions}
        </div>
      </div>

      {modalOpen && previewUrl && (
        <div
          className="static-image-viewer-overlay fixed inset-0 z-50 flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${filename}`}
          onClick={() => setModalOpen(false)}
        >
          <div
            data-static-image-viewer-panel={previewKind === "image" ? viewerVariant : "document"}
            className={`static-image-viewer-panel grid h-full w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl sm:h-[min(92dvh,900px)] ${previewKind === "image" ? "bg-transparent" : "bg-white shadow-2xl"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`static-image-viewer-panel-header flex items-center justify-between gap-3 border-b px-4 py-3 ${previewKind === "image" ? "border-transparent bg-transparent text-white" : "border-border bg-surface/70"}`}>
              <div className="min-w-0">
                <p className={`truncate text-[13px] font-bold ${previewKind === "image" ? "text-white" : "text-foreground"}`}>{filename}</p>
                <p className={`text-[11px] ${previewKind === "image" ? "text-white/60" : "text-muted"}`}>{typeLabel} preview</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className={`rounded-lg p-2 transition-colors ${previewKind === "image" ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-muted hover:bg-white hover:text-foreground"}`}
                aria-label="Close preview"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 overflow-hidden">
              {previewKind === "image" ? (
                <NativeStaticImageStage
                  variant={viewerVariant}
                  src={previewUrl}
                  alt={filename}
                  stageClassName="h-full w-full"
                />
              ) : (
                <iframe
                  src={previewUrl}
                  title={filename}
                  className="w-full h-full bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PreviewSurface({
  kind,
  filename,
  previewUrl,
  loading,
  fit,
  onImageAspectRatio,
}: {
  kind: FilePreviewKind;
  filename: string;
  previewUrl: string | null;
  loading: boolean;
  fit: "cover" | "contain";
  onImageAspectRatio?: (aspectRatio: number) => void;
}) {
  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-muted">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
        <span className="mt-1 text-[10px] font-semibold">Loading</span>
      </div>
    );
  }

  if (kind === "image" && previewUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={previewUrl}
        alt={filename}
        loading="lazy"
        decoding="async"
        className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
        onLoad={(event) => {
          const { naturalHeight, naturalWidth } = event.currentTarget;
          if (naturalWidth > 0 && naturalHeight > 0) {
            onImageAspectRatio?.(naturalWidth / naturalHeight);
          }
        }}
      />
    );
  }

  const icon =
    getFileExtensionLabel(filename) === "ZIP" ? (
      <FileArchive className="w-7 h-7 text-primary" aria-hidden />
    ) : kind === "image" ? (
      <ImageIcon className="w-7 h-7 text-primary" aria-hidden />
    ) : (
      <FileText className="w-7 h-7 text-primary" aria-hidden />
    );

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-3 text-center">
      {icon}
      <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/70">
        {kind === "unsupported" ? "No preview" : getFileTypeLabel(filename)}
      </span>
    </div>
  );
}

function getFileExtensionLabel(filename: string): string {
  return filename.split(".").pop()?.toUpperCase() ?? "";
}
