"use client";

import { AlertTriangle, Check, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PROPERTY_MARKETING_PREVIEW_DEBOUNCE_MS } from "@/features/property-showcase/marketing-preview-client";
import type { PropertyShowcase } from "@/features/property-showcase/types";

type PreviewStatus = "idle" | "updating" | "ready" | "error";

export default function PropertySocialCardPreview({
  propertyId,
  property,
  changed,
}: {
  propertyId: string;
  property: PropertyShowcase;
  changed: boolean;
}) {
  const requestBody = useMemo(() => JSON.stringify({ property }), [property]);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRetry, setPreviewRetry] = useState(0);
  const sequence = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const requestSequence = ++sequence.current;
    const timer = window.setTimeout(async () => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setPreviewStatus("updating");
      setPreviewError(null);
      try {
        const response = await fetch(
          `/api/admin/properties/${encodeURIComponent(propertyId)}/social-card/preview`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error ?? "Could not update the social preview.");
        }
        const blob = await response.blob();
        if (controller.signal.aborted || requestSequence !== sequence.current) return;
        const nextUrl = URL.createObjectURL(blob);
        const previousUrl = previewUrlRef.current;
        previewUrlRef.current = nextUrl;
        setPreviewUrl(nextUrl);
        setPreviewStatus("ready");
        if (previousUrl) URL.revokeObjectURL(previousUrl);
      } catch (error) {
        if (controller.signal.aborted || requestSequence !== sequence.current) return;
        setPreviewStatus("error");
        setPreviewError(
          error instanceof Error ? error.message : "Could not update the social preview.",
        );
      }
    }, PROPERTY_MARKETING_PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [propertyId, previewRetry, requestBody]);

  useEffect(() => () => {
    abort.current?.abort();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative mx-auto aspect-[1200/630] max-w-4xl overflow-hidden rounded-lg border border-border bg-[#0B1F3A]">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Generated unsaved social sharing preview" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center gap-2 px-6 text-center text-sm font-bold text-white"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Preparing generated preview…</div>
        )}
        {previewStatus === "updating" && previewUrl ? (
          <span className="absolute inset-x-3 bottom-3 inline-flex items-center justify-center gap-2 rounded-lg bg-black/70 px-3 py-2 text-xs font-bold text-white backdrop-blur"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Updating preview…</span>
        ) : null}
      </div>
      <div aria-live="polite" className="flex min-h-5 items-center gap-2 text-xs text-muted">
        {previewStatus === "ready" ? <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden /> : previewStatus === "error" ? <AlertTriangle className="h-3.5 w-3.5 text-red-700" aria-hidden /> : <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
        {previewStatus === "updating" ? "Updating preview from unsaved changes…" : previewStatus === "ready" ? changed ? "Preview updated — unsaved changes are shown." : "Preview updated." : previewStatus === "error" ? `Preview error — Retry. ${previewError ?? ""}`.trim() : "Preparing the generated preview…"}
      </div>
      {previewStatus === "error" ? <button type="button" onClick={() => setPreviewRetry((current) => current + 1)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-800"><RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry preview</button> : null}
    </div>
  );
}
