"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileArchive,
  FileText,
  ImageIcon,
  Loader2,
  X,
} from "lucide-react";
import {
  getFilePreviewKind,
  getFileTypeLabel,
  type FilePreviewKind,
} from "@/lib/file-preview";
import { useViewerScrollLock } from "@/components/media/useViewerScrollLock";
import { NativeStaticImageStage } from "@/components/media/StaticImageStage";
import type { StaticImageViewerVariant } from "@/components/media/static-image-variant";
import {
  getAdjacentViewerIndex,
  type JobImageViewerItem,
} from "@/lib/client-job-image-navigation";

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
  viewerItems?: JobImageViewerItem[];
  viewerItemId?: string;
}

type SignedUrlResponse = {
  ok?: boolean;
  signedUrl: string;
  filename: string;
};

async function requestSignedUrl(
  endpoint: string,
  intent: "preview" | "download",
): Promise<SignedUrlResponse> {
  const res = await fetch(endpoint, {
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
  viewerItems,
  viewerItemId,
}: Props) {
  const previewKind = getFilePreviewKind(filename, mimeType);
  const typeLabel = getFileTypeLabel(filename, mimeType);
  const previewable = previewKind !== "unsupported";
  const usesImageOverlayDownload = presentation === "feature" && previewKind === "image";

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeViewerIndex, setActiveViewerIndex] = useState<number | null>(null);
  const [activeViewerUrl, setActiveViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const activeViewerIndexRef = useRef<number | null>(null);
  const viewerLoadingRef = useRef(false);
  const previewUrlCacheRef = useRef<Map<string, string>>(new Map());
  useViewerScrollLock(modalOpen);

  const initialViewerIndex =
    viewerItems && viewerItemId
      ? viewerItems.findIndex((item) => item.id === viewerItemId)
      : -1;
  const activeViewerItem =
    activeViewerIndex !== null && viewerItems?.[activeViewerIndex]
      ? viewerItems[activeViewerIndex]
      : null;
  const activeFilename = activeViewerItem?.filename ?? filename;
  const viewerTotal = viewerItems?.length ?? 0;
  const hasViewerNavigation =
    previewKind === "image" && initialViewerIndex >= 0 && viewerTotal > 1;
  const previousViewerIndex =
    activeViewerIndex === null
      ? null
      : getAdjacentViewerIndex(activeViewerIndex, viewerTotal, -1);
  const nextViewerIndex =
    activeViewerIndex === null
      ? null
      : getAdjacentViewerIndex(activeViewerIndex, viewerTotal, 1);

  useEffect(() => {
    if (previewKind !== "image" || previewUrl || previewLoading) return;
    void loadPreviewUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKind]);

  async function loadPreviewUrl(): Promise<string | null> {
    if (!previewable) return null;
    if (previewUrl) return previewUrl;
    const cached = previewUrlCacheRef.current.get(signedUrlEndpoint);
    if (cached) {
      setPreviewUrl(cached);
      return cached;
    }

    setPreviewLoading(true);
    setError(null);
    try {
      const data = await requestSignedUrl(signedUrlEndpoint, "preview");
      previewUrlCacheRef.current.set(signedUrlEndpoint, data.signedUrl);
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
    if (url) {
      const nextIndex = initialViewerIndex >= 0 ? initialViewerIndex : null;
      activeViewerIndexRef.current = nextIndex;
      setActiveViewerIndex(nextIndex);
      setActiveViewerUrl(url);
      setModalOpen(true);
    }
  }

  async function handleDownload() {
    if (downloadLoading) return;
    setDownloadLoading(true);
    setError(null);

    try {
      const data = await requestSignedUrl(signedUrlEndpoint, "download");
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

  const closeViewer = useCallback(() => {
    setModalOpen(false);
  }, []);

  const navigateViewer = useCallback(async (direction: -1 | 1) => {
    if (!viewerItems || viewerLoadingRef.current) return;
    const currentIndex = activeViewerIndexRef.current;
    if (currentIndex === null) return;
    const adjacentIndex = getAdjacentViewerIndex(
      currentIndex,
      viewerItems.length,
      direction,
    );
    if (adjacentIndex === null) return;

    const adjacentItem = viewerItems[adjacentIndex];
    const cached = previewUrlCacheRef.current.get(adjacentItem.signedUrlEndpoint);
    viewerLoadingRef.current = true;
    setViewerLoading(true);
    setError(null);

    try {
      const nextUrl = cached ?? (
        await requestSignedUrl(adjacentItem.signedUrlEndpoint, "preview")
      ).signedUrl;
      previewUrlCacheRef.current.set(adjacentItem.signedUrlEndpoint, nextUrl);
      activeViewerIndexRef.current = adjacentIndex;
      setActiveViewerIndex(adjacentIndex);
      setActiveViewerUrl(nextUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      viewerLoadingRef.current = false;
      setViewerLoading(false);
    }
  }, [viewerItems]);

  useEffect(() => {
    if (!modalOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeViewer();
      } else if (previewKind === "image" && event.key === "ArrowLeft") {
        event.preventDefault();
        void navigateViewer(-1);
      } else if (previewKind === "image" && event.key === "ArrowRight") {
        event.preventDefault();
        void navigateViewer(1);
      } else if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]),a[href]:not([aria-disabled="true"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable.at(-1) ?? first;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [closeViewer, modalOpen, navigateViewer, previewKind]);

  const previewSurface = (
    <PreviewSurface
      kind={previewKind}
      filename={filename}
      previewUrl={previewUrl}
      loading={previewLoading}
      fit={presentation === "feature" ? "contain" : "cover"}
    />
  );

  function renderPreviewDialog() {
    return (
      <>
        {modalOpen && previewUrl && (
          <div
            ref={dialogRef}
            className="static-image-viewer-overlay fixed inset-0 z-50 grid h-[100dvh] w-screen place-items-center overflow-hidden bg-black/85 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={previewKind === "image" ? `Image viewer: ${activeFilename}` : `Preview ${filename}`}
            tabIndex={-1}
            onClick={closeViewer}
          >
            {previewKind === "image" ? (
              <div
                data-static-image-viewer-panel={viewerVariant}
                className="static-image-viewer-root mx-auto grid h-full w-full max-w-[1728px] grid-rows-[auto_minmax(0,1fr)] gap-3 bg-transparent sm:gap-4"
              >
                <div
                  className="static-image-viewer-header mx-auto grid w-full max-w-[1600px] grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  <span aria-hidden />
                  <div className="min-w-0 text-center">
                    <p className="truncate text-[11px] font-semibold text-white sm:text-sm" title={activeFilename}>
                      {activeFilename}
                    </p>
                    {hasViewerNavigation && activeViewerIndex !== null ? (
                      <p className="mt-0.5 hidden text-[10px] font-medium tabular-nums text-white/70 sm:block sm:text-xs">
                        {activeViewerIndex + 1} / {viewerTotal}
                      </p>
                    ) : null}
                    {error ? (
                      <p role="alert" className="mt-0.5 truncate text-[10px] font-medium text-amber-200">
                        {error}
                      </p>
                    ) : null}
                  </div>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      closeViewer();
                    }}
                    aria-label="Close viewer"
                    className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/45 text-white shadow-lg transition-colors hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                </div>

                <div className="static-image-viewer-layout mx-auto grid min-h-0 w-full grid-cols-[3rem_minmax(0,1fr)_3rem] grid-rows-[minmax(0,1fr)_auto] gap-x-2 gap-y-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] sm:gap-x-4">
                  <div
                    data-static-image-viewer-frame
                    className="relative col-span-3 row-start-1 min-h-0 overflow-hidden rounded-xl sm:col-span-1 sm:col-start-2 sm:rounded-2xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <NativeStaticImageStage
                      key={activeViewerUrl ?? previewUrl}
                      variant={viewerVariant}
                      src={activeViewerUrl ?? previewUrl}
                      alt={activeFilename}
                      loading="eager"
                      stageClassName="h-full w-full"
                    >
                      {viewerLoading ? (
                        <div className="absolute inset-0 grid place-items-center bg-black/25" aria-live="polite">
                          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white shadow-lg">
                            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                            <span className="sr-only">Loading image</span>
                          </span>
                        </div>
                      ) : null}
                    </NativeStaticImageStage>
                  </div>

                  {hasViewerNavigation ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void navigateViewer(-1);
                      }}
                      disabled={previousViewerIndex === null || viewerLoading}
                      aria-label="Previous image"
                      className="static-image-viewer-control col-start-1 row-start-2 grid h-11 w-11 place-items-center self-center justify-self-center rounded-full border border-white/25 bg-black/55 text-white shadow-lg transition-colors hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-35 sm:row-start-1 sm:h-12 sm:w-12"
                    >
                      <ChevronLeft className="h-6 w-6" aria-hidden />
                    </button>
                  ) : null}

                  {hasViewerNavigation ? (
                    <span
                      className="col-start-2 row-start-2 self-center justify-self-center text-xs font-medium tabular-nums text-white/80 sm:hidden"
                      aria-hidden
                    >
                      {activeViewerIndex !== null ? activeViewerIndex + 1 : 1} / {viewerTotal}
                    </span>
                  ) : null}

                  {hasViewerNavigation ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void navigateViewer(1);
                      }}
                      disabled={nextViewerIndex === null || viewerLoading}
                      aria-label="Next image"
                      className="static-image-viewer-control col-start-3 row-start-2 grid h-11 w-11 place-items-center self-center justify-self-center rounded-full border border-white/25 bg-black/55 text-white shadow-lg transition-colors hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-35 sm:row-start-1 sm:h-12 sm:w-12"
                    >
                      <ChevronRight className="h-6 w-6" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div
                data-static-image-viewer-panel="document"
                className="static-image-viewer-panel mx-auto grid h-full w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl bg-white shadow-2xl sm:h-[min(92dvh,900px)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="static-image-viewer-panel-header flex items-center justify-between gap-3 border-b border-border bg-surface/70 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-foreground [[data-dashboard-scroll-container]_&]:text-dashboard-action" title={filename}>{filename}</p>
                    <p className="text-[11px] text-muted [[data-dashboard-scroll-container]_&]:text-dashboard-metadata">{typeLabel} preview</p>
                  </div>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={closeViewer}
                    className="grid h-11 w-11 place-items-center rounded-lg text-muted transition-colors hover:bg-white hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    aria-label="Close preview"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="min-h-0 overflow-hidden">
                  <iframe
                    src={previewUrl}
                    title={filename}
                    className="h-full w-full bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  if (presentation === "feature") {
    return (
      <>
        <div className="w-full min-w-0">
          <div
            data-feature-image-frame={usesImageOverlayDownload ? "" : undefined}
            className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-surface"
          >
            <button
              data-preview-control
              type="button"
              onClick={openPreview}
              disabled={!previewable}
              className={[
                "absolute inset-0 flex h-full w-full",
                previewable
                  ? "cursor-pointer transition-colors hover:bg-primary/3"
                  : "cursor-default",
              ].join(" ")}
              title={previewable ? `Preview ${filename}` : "Preview not available"}
            >
              {previewSurface}
            </button>

            {usesImageOverlayDownload ? (
              <button
                data-download-control
                type="button"
                onClick={handleDownload}
                disabled={downloadLoading}
                className="feature-image-download-control absolute bottom-4 left-1/2 z-10 inline-flex min-h-11 -translate-x-1/2 items-center justify-center gap-2 rounded-md border border-secondary bg-secondary px-5 py-2.5 text-dashboard-action font-bold text-white shadow-lg transition-[opacity,background-color] hover:bg-secondary/90 focus-visible:bg-secondary disabled:cursor-wait disabled:opacity-70"
                title={`${downloadLoading ? "Preparing download for" : "Download"} ${filename}`}
                aria-label={`${downloadLoading ? "Preparing download for" : "Download"} ${filename}`}
              >
                {downloadLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" aria-hidden />
                    Download
                  </>
                )}
              </button>
            ) : null}
          </div>

          {usesImageOverlayDownload ? (
            meta || error || actions ? (
              <div className="mt-3 min-w-0">
                {meta && <div>{meta}</div>}
                {error && (
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-red-600 [[data-dashboard-scroll-container]_&]:text-dashboard-metadata">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden />
                    {error}
                  </p>
                )}
                {actions && <div className="mt-4 border-t border-border pt-4">{actions}</div>}
              </div>
            ) : null
          ) : (
            <div data-feature-file-details className="mt-3 min-w-0">
              <button
                type="button"
                onClick={openPreview}
                disabled={!previewable}
                className={[
                  "block max-w-full break-words text-left text-[13px] font-semibold leading-snug text-foreground [[data-dashboard-scroll-container]_&]:text-dashboard-action",
                  previewable ? "transition-colors hover:text-primary" : "cursor-default",
                ].join(" ")}
                title={filename}
              >
                {filename}
              </button>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {badgeLabel && (
                  <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/8 px-1.5 py-0.5 text-[10px] font-semibold text-primary [[data-dashboard-scroll-container]_&]:text-dashboard-metadata">
                    {badgeLabel}
                  </span>
                )}
                {fileSizeLabel && <span className="text-[11px] text-muted [[data-dashboard-scroll-container]_&]:text-dashboard-metadata">{fileSizeLabel}</span>}
                <span className="text-[11px] font-semibold text-foreground/70 [[data-dashboard-scroll-container]_&]:text-dashboard-metadata">{typeLabel}</span>
                {!previewable && <span className="text-[11px] text-muted [[data-dashboard-scroll-container]_&]:text-dashboard-metadata">Preview not available</span>}
              </div>
              {meta && <div className="mt-2">{meta}</div>}
              {error && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-red-600 [[data-dashboard-scroll-container]_&]:text-dashboard-metadata">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden />
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloadLoading}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-primary-light disabled:opacity-60 [[data-dashboard-scroll-container]_&]:text-dashboard-action"
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
          )}
        </div>
        {renderPreviewDialog()}
      </>
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
              "block text-left text-[13px] font-semibold text-foreground truncate [[data-dashboard-scroll-container]_&]:text-dashboard-action [[data-dashboard-scroll-container]_&]:max-w-full",
              previewable ? "hover:text-primary transition-colors" : "cursor-default",
            ].join(" ")}
            title={filename}
          >
            {filename}
          </button>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1">
            {badgeLabel && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-primary/15 bg-primary/8 text-[10px] font-semibold text-primary [[data-dashboard-scroll-container]_&]:text-dashboard-metadata">
                {badgeLabel}
              </span>
            )}
            {fileSizeLabel && (
              <span className="text-[11px] text-muted [[data-dashboard-scroll-container]_&]:text-dashboard-metadata">{fileSizeLabel}</span>
            )}
            <span className="text-[11px] font-semibold text-foreground/70 [[data-dashboard-scroll-container]_&]:text-dashboard-metadata">
              {typeLabel}
            </span>
            {!previewable && (
              <span className="text-[11px] text-muted [[data-dashboard-scroll-container]_&]:text-dashboard-metadata">Preview not available</span>
            )}
          </div>
          {meta && <div className="mt-1">{meta}</div>}
          {error && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600 [[data-dashboard-scroll-container]_&]:text-dashboard-metadata">
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
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-[12px] font-semibold hover:bg-primary-light transition-colors shadow-sm disabled:opacity-60 [[data-dashboard-scroll-container]_&]:text-dashboard-action"
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

      {renderPreviewDialog()}
    </>
  );
}

function PreviewSurface({
  kind,
  filename,
  previewUrl,
  loading,
  fit,
}: {
  kind: FilePreviewKind;
  filename: string;
  previewUrl: string | null;
  loading: boolean;
  fit: "cover" | "contain";
}) {
  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-muted">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
        <span className="mt-1 text-[10px] font-semibold [[data-dashboard-scroll-container]_&]:text-dashboard-metadata">Loading</span>
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
      <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/70 [[data-dashboard-scroll-container]_&]:text-dashboard-metadata">
        {kind === "unsupported" ? "No preview" : getFileTypeLabel(filename)}
      </span>
    </div>
  );
}

function getFileExtensionLabel(filename: string): string {
  return filename.split(".").pop()?.toUpperCase() ?? "";
}
