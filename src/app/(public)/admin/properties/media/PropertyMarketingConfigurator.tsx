"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Crosshair,
  Download,
  ExternalLink,
  FileImage,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Save,
  Star,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { focalPointToObjectPosition } from "@/features/property-showcase/focal-point";
import {
  PROPERTY_MARKETING_PREVIEW_DEBOUNCE_MS,
  shouldApplyPropertyMarketingPreview,
} from "@/features/property-showcase/marketing-preview-client";
import {
  brochureSupportingImageLimit,
  moveBrochureSupportingImage,
  normalizePropertyMarketingMaterialsConfig,
  propertyHighlightId,
  resetPropertyMarketingMaterialsConfig,
  replaceBrochureSupportingImage,
  setBrochurePrimaryImage,
  toggleBrochureSupportingImage,
  toCanonicalPropertyMarketingMaterialsConfig,
} from "@/features/property-showcase/marketing-materials";
import {
  PROPERTY_SOCIAL_CARD_FACT_KEYS,
  PROPERTY_SOCIAL_CARD_FACT_LABELS,
} from "@/features/property-showcase/social-card";
import type {
  PropertyGalleryImage,
  PropertyMarketingBrochureOrientation,
  PropertyMarketingBrochureTemplate,
  PropertyMarketingMaterialsConfig,
  PropertyShowcase,
  PropertySocialCardFactKey,
} from "@/features/property-showcase/types";

interface PropertyMarketingConfiguratorProps {
  propertyId: string;
  propertySlug: string;
  property: PropertyShowcase;
  gallery: PropertyGalleryImage[];
  value: PropertyMarketingMaterialsConfig;
  changed: boolean;
  saving: boolean;
  onChange: (value: PropertyMarketingMaterialsConfig) => void;
  onEditFocalPoint: (mediaId: string) => void;
  onSave: () => Promise<void>;
}

type PreviewStatus = "idle" | "updating" | "ready" | "error";

const PORTRAIT_TEMPLATES = [
  { value: "a4-classic", label: "A4 Classic", detail: "Structured photo strip and listing details" },
  { value: "a4-editorial", label: "A4 Editorial", detail: "Large hero with an editorial content flow" },
] as const;

const LANDSCAPE_TEMPLATES = [
  { value: "single-hero", label: "Single Hero", detail: "One immersive property photograph" },
  { value: "hero-two-square", label: "Hero + supporting", detail: "Main image with up to two supporting views" },
  { value: "hero-four-grid", label: "Hero + four grid", detail: "Main image with up to four details" },
] as const;

function BrochureTemplateMiniature({
  template,
}: {
  template: PropertyMarketingBrochureTemplate;
}) {
  const portrait = template.startsWith("a4-");
  return (
    <span
      aria-hidden
      className={`flex overflow-hidden rounded-md border border-current/20 bg-[#0B1F3A] ${portrait ? "h-16 w-11 flex-col" : "h-11 w-20"}`}
    >
      <span className={portrait ? "h-7 bg-[#cfb980]" : "w-3/5 bg-[#cfb980]"} />
      <span className={`flex flex-1 gap-px bg-white/90 p-1 ${portrait ? "flex-col" : "flex-col"}`}>
        <span className="h-1.5 w-4/5 rounded bg-[#0B1F3A]" />
        <span className="h-1 w-full rounded bg-slate-300" />
        {template.includes("four") || template.includes("editorial") ? (
          <span className="mt-auto grid grid-cols-2 gap-px">
            <span className="h-2 bg-[#cfb980]" /><span className="h-2 bg-[#cfb980]" />
          </span>
        ) : null}
      </span>
    </span>
  );
}

function GalleryThumbnail({
  image,
  className = "",
}: {
  image: PropertyGalleryImage;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`relative block overflow-hidden bg-slate-100 ${className}`}>
      {failed ? (
        <span className="flex h-full min-h-20 items-center justify-center px-2 text-center text-[10px] font-bold text-red-700">
          Image unavailable
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.src}
          alt=""
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
          style={{ objectPosition: focalPointToObjectPosition(image.focalPoint) }}
        />
      )}
      <span
        className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#B88A44]/90 shadow"
        style={{
          left: `${(image.focalPoint?.x ?? 0.5) * 100}%`,
          top: `${(image.focalPoint?.y ?? 0.5) * 100}%`,
        }}
      />
    </span>
  );
}

export default function PropertyMarketingConfigurator({
  propertyId,
  propertySlug,
  property,
  gallery,
  value,
  changed,
  saving,
  onChange,
  onEditFocalPoint,
  onSave,
}: PropertyMarketingConfiguratorProps) {
  const normalized = normalizePropertyMarketingMaterialsConfig(value, property);
  const canonical = useMemo(
    () => toCanonicalPropertyMarketingMaterialsConfig(value, property),
    [property, value],
  );
  const legacyNormalized = useMemo(
    () => normalizePropertyMarketingMaterialsConfig(property.marketingMaterials, property).legacyNormalized,
    [property],
  );
  const [lastPortraitTemplate, setLastPortraitTemplate] =
    useState<PropertyMarketingBrochureTemplate>(
      normalized.brochure.orientation === "portrait"
        ? normalized.brochure.template
        : "a4-editorial",
    );
  const [lastLandscapeTemplate, setLastLandscapeTemplate] =
    useState<PropertyMarketingBrochureTemplate>(
      normalized.brochure.orientation === "landscape"
        ? normalized.brochure.template
        : "hero-two-square",
    );
  const [replaceSupportingIndex, setReplaceSupportingIndex] = useState<number | null>(null);
  const [draggedSupportingId, setDraggedSupportingId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRetry, setPreviewRetry] = useState(0);
  const previewSequence = useRef(0);
  const previewAbort = useRef<AbortController | null>(null);
  const primary = gallery.find((image) => image.id === normalized.brochure.primaryMediaId)
    ?? gallery.find((image) => image.src === property.coverImage)
    ?? gallery[0];
  const selectedSupporting = normalized.brochure.supportingMediaIds.map((id) => ({
    id,
    image: gallery.find((candidate) => candidate.id === id),
  }));
  const supportingLimit = brochureSupportingImageLimit(normalized.brochure.template);
  const templates = normalized.brochure.orientation === "portrait"
    ? PORTRAIT_TEMPLATES
    : LANDSCAPE_TEMPLATES;
  const focalPoints = useMemo(
    () => gallery.map((image) => ({
      mediaId: image.id,
      focalPoint: image.focalPoint ?? { x: 0.5, y: 0.5 },
    })),
    [gallery],
  );
  const previewBody = useMemo(
    () => JSON.stringify({ marketingMaterials: canonical, focalPoints }),
    [canonical, focalPoints],
  );

  useEffect(() => {
    const sequence = ++previewSequence.current;
    const timer = window.setTimeout(async () => {
      previewAbort.current?.abort();
      const controller = new AbortController();
      previewAbort.current = controller;
      setPreviewStatus("updating");
      setPreviewError(null);
      try {
        const response = await fetch(
          `/api/admin/properties/${encodeURIComponent(propertyId)}/materials/preview`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: previewBody,
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error ?? "Could not update the brochure preview.");
        }
        const blob = await response.blob();
        if (
          !shouldApplyPropertyMarketingPreview(
            sequence,
            previewSequence.current,
            controller.signal.aborted,
          )
        ) return;
        const nextUrl = URL.createObjectURL(blob);
        const previousUrl = previewUrlRef.current;
        previewUrlRef.current = nextUrl;
        setPreviewUrl(nextUrl);
        setPreviewStatus("ready");
        if (previousUrl) URL.revokeObjectURL(previousUrl);
      } catch (error) {
        if (
          !shouldApplyPropertyMarketingPreview(
            sequence,
            previewSequence.current,
            controller.signal.aborted,
          )
        ) return;
        setPreviewStatus("error");
        setPreviewError(
          error instanceof Error ? error.message : "Could not update the brochure preview.",
        );
      }
    }, PROPERTY_MARKETING_PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [previewBody, previewRetry, propertyId]);

  useEffect(() => () => {
    previewAbort.current?.abort();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function update(next: Partial<PropertyMarketingMaterialsConfig>) {
    onChange({ ...canonical, ...next });
  }

  function updateBrochure(
    next: Partial<NonNullable<PropertyMarketingMaterialsConfig["brochure"]>>,
  ) {
    onChange({
      ...canonical,
      brochure: { ...normalized.brochure, ...next },
    });
  }

  function chooseOrientation(orientation: PropertyMarketingBrochureOrientation) {
    if (orientation === normalized.brochure.orientation) return;
    if (normalized.brochure.orientation === "portrait") {
      setLastPortraitTemplate(normalized.brochure.template);
    } else {
      setLastLandscapeTemplate(normalized.brochure.template);
    }
    updateBrochure({
      orientation,
      template: orientation === "portrait" ? lastPortraitTemplate : lastLandscapeTemplate,
    });
  }

  function chooseTemplate(template: PropertyMarketingBrochureTemplate) {
    if (normalized.brochure.orientation === "portrait") setLastPortraitTemplate(template);
    else setLastLandscapeTemplate(template);
    updateBrochure({ template });
  }

  function choosePrimary(mediaId: string) {
    updateBrochure(setBrochurePrimaryImage(normalized.brochure, mediaId));
  }

  function chooseSupporting(mediaId: string) {
    if (mediaId === normalized.brochure.primaryMediaId) return;
    if (replaceSupportingIndex !== null) {
      const next = replaceBrochureSupportingImage(
        normalized.brochure,
        replaceSupportingIndex,
        mediaId,
      );
      setReplaceSupportingIndex(null);
      updateBrochure(next);
      return;
    }
    updateBrochure(toggleBrochureSupportingImage(normalized.brochure, mediaId));
  }

  function moveSupporting(mediaId: string, direction: -1 | 1) {
    updateBrochure(
      moveBrochureSupportingImage(normalized.brochure, mediaId, direction),
    );
  }

  function dropSupporting(targetId: string) {
    if (!draggedSupportingId || draggedSupportingId === targetId) return;
    const next = [...normalized.brochure.supportingMediaIds];
    const from = next.indexOf(draggedSupportingId);
    const to = next.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    updateBrochure({ supportingMediaIds: next });
    setDraggedSupportingId(null);
  }

  function focusPicker() {
    pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    pickerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }

  const savedDownload = `/admin/properties/${encodeURIComponent(propertyId)}/materials/brochure.pdf`;

  return (
    <section
      data-testid="marketing-material-settings"
      className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
    >
      <header className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">Marketing materials</p>
          <h2 className="mt-1 text-lg font-bold text-primary">7. Property flyer</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
            Configure one downloadable brochure from the existing gallery. The social/Open Graph card remains independent.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(resetPropertyMarketingMaterialsConfig())}
          className="shrink-0 rounded-xl border border-border px-3.5 py-2 text-sm font-bold text-primary hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Reset defaults
        </button>
      </header>

      {legacyNormalized ? (
        <div className="mx-5 mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>The previous landscape/portrait settings were normalized to one brochure format. Review the selection before saving.</span>
        </div>
      ) : null}

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)] lg:items-start">
        <div className="space-y-6">
          <label className="flex items-start gap-3 rounded-xl border border-border p-4 text-sm">
            <input
              type="checkbox"
              checked={normalized.enabled}
              onChange={(event) => update({ enabled: event.target.checked })}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="block font-bold text-primary">Enable downloadable property flyer</span>
              <span className="mt-1 block text-xs leading-5 text-muted">The public preview and download action appear after these settings are saved.</span>
            </span>
          </label>

          <fieldset>
            <legend className="text-sm font-bold text-primary">Brochure format</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(["portrait", "landscape"] as const).map((orientation) => {
                const selected = normalized.brochure.orientation === orientation;
                return (
                  <button
                    key={orientation}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseOrientation(orientation)}
                    className={`flex min-h-28 items-center gap-4 rounded-2xl border-2 p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/35"}`}
                  >
                    <span aria-hidden className={`grid place-items-center rounded-md bg-[#0B1F3A] ${orientation === "portrait" ? "h-20 w-14" : "h-14 w-24"}`}>
                      <span className="h-2/3 w-2/3 rounded-sm bg-[#cfb980]" />
                    </span>
                    <span>
                      <span className="block font-bold text-primary">{orientation === "portrait" ? "Portrait / A4" : "Landscape"}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted">{orientation === "portrait" ? "Print-first one-page flyer" : "Wide digital and A4 landscape brochure"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-bold text-primary">Template</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {templates.map((template) => {
                const selected = normalized.brochure.template === template.value;
                return (
                  <button
                    key={template.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseTemplate(template.value)}
                    className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/35"}`}
                  >
                    <BrochureTemplateMiniature template={template.value} />
                    <span>
                      <span className="block text-sm font-bold text-primary">{template.label}</span>
                      <span className="mt-1 block text-xs leading-4 text-muted">{template.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="lg:sticky lg:top-5 lg:row-span-3 lg:col-start-2 lg:row-start-1">
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-primary">Live brochure preview</h3>
                <p className="mt-1 text-xs text-muted">Uses unsaved form values and the final server renderer.</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${changed ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
                {saving ? "Saving…" : changed ? "Unsaved changes" : "Saved"}
              </span>
            </div>
            <div
              className={`relative mt-4 flex max-h-[70vh] min-h-64 items-center justify-center overflow-hidden rounded-xl bg-[#0B1F3A] ${normalized.brochure.orientation === "portrait" ? "aspect-[620/877]" : "aspect-video"}`}
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={`Unsaved ${normalized.brochure.orientation} property brochure preview`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 px-6 text-center text-white">
                  <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
                  <span className="text-sm font-bold">Preparing the first preview…</span>
                </div>
              )}
              {previewStatus === "updating" && previewUrl ? (
                <span className="absolute inset-x-3 bottom-3 inline-flex items-center justify-center gap-2 rounded-lg bg-black/70 px-3 py-2 text-xs font-bold text-white backdrop-blur">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Updating preview…
                </span>
              ) : null}
            </div>
            <div aria-live="polite" className="mt-3 min-h-5 text-xs text-muted">
              {previewStatus === "updating"
                ? "Updating preview from unsaved changes…"
                : previewStatus === "ready"
                  ? "Preview reflects unsaved changes."
                  : previewStatus === "error"
                    ? previewError
                    : "Waiting to render preview…"}
            </div>
            {previewStatus === "error" ? (
              <button
                type="button"
                onClick={() => setPreviewRetry((current) => current + 1)}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retry preview
              </button>
            ) : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!previewUrl}
                onClick={() => previewUrl && window.open(previewUrl, "_blank", "noopener,noreferrer")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-bold text-primary disabled:opacity-40"
              >
                <ExternalLink className="h-4 w-4" aria-hidden /> Open preview
              </button>
              <a
                href={savedDownload}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-center text-sm font-bold text-primary"
              >
                <Download className="h-4 w-4" aria-hidden /> Test saved PDF
              </a>
            </div>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !changed}
              className="mt-2 hidden min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-45 lg:inline-flex"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : changed ? <Save className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
              {saving ? "Saving…" : changed ? "Save changes" : "Saved"}
            </button>
          </div>
        </div>

        <div className="space-y-5 lg:col-start-1">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-primary">Photos</h3>
                <p className="mt-1 text-xs leading-5 text-muted">Select existing gallery images. The focal point controls every crop.</p>
              </div>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-muted">Up to {supportingLimit} supporting used by this template</span>
            </div>

            <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Primary image</p>
              {primary ? (
                <div className="mt-2 grid gap-3 sm:grid-cols-[150px_1fr]">
                  <GalleryThumbnail image={primary} className="aspect-[4/3] rounded-xl" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-white">Main</span>
                      <span className="truncate text-sm font-bold text-primary">{primary.label.en || "Untitled photo"}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={focusPicker} className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold text-primary">Replace</button>
                      <button type="button" onClick={() => onEditFocalPoint(primary.id)} className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold text-primary"><Crosshair className="h-3.5 w-3.5" aria-hidden /> Focal point</button>
                    </div>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={focusPicker} className="mt-2 flex min-h-28 w-full items-center justify-center rounded-xl border-2 border-dashed border-border text-sm font-bold text-primary">Choose primary image</button>
              )}
            </div>

            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Supporting image order</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {selectedSupporting.map(({ id, image }, index) => (
                  <div
                    key={id}
                    draggable
                    onDragStart={() => setDraggedSupportingId(id)}
                    onDragEnd={() => setDraggedSupportingId(null)}
                    onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
                    onDrop={() => dropSupporting(id)}
                    className={`rounded-xl border p-2 ${index < supportingLimit ? "border-border bg-white" : "border-amber-200 bg-amber-50"}`}
                  >
                    {image ? (
                      <div className="flex gap-3">
                        <GalleryThumbnail image={image} className="h-20 w-24 shrink-0 rounded-lg" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-white">{index + 1}</span>
                            <span className="truncate text-xs font-bold text-primary">{image.label.en || "Untitled photo"}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <button type="button" onClick={() => moveSupporting(id, -1)} disabled={index === 0} aria-label={`Move ${image.label.en} left`} className="grid h-7 w-7 place-items-center rounded border border-border disabled:opacity-30"><ArrowLeft className="h-3 w-3" aria-hidden /></button>
                            <button type="button" onClick={() => moveSupporting(id, 1)} disabled={index === selectedSupporting.length - 1} aria-label={`Move ${image.label.en} right`} className="grid h-7 w-7 place-items-center rounded border border-border disabled:opacity-30"><ArrowRight className="h-3 w-3" aria-hidden /></button>
                            <button type="button" onClick={() => { setReplaceSupportingIndex(index); focusPicker(); }} className="rounded border border-border px-2 text-[10px] font-bold">Replace</button>
                            <button type="button" onClick={() => updateBrochure({ supportingMediaIds: normalized.brochure.supportingMediaIds.filter((item) => item !== id) })} aria-label={`Remove ${image.label.en} from brochure`} className="ml-auto grid h-7 w-7 place-items-center rounded border border-red-200 text-red-700"><Trash2 className="h-3 w-3" aria-hidden /></button>
                            <button type="button" onClick={() => onEditFocalPoint(id)} aria-label={`Edit focal point for ${image.label.en}`} className="grid h-7 w-7 place-items-center rounded border border-border text-primary"><Crosshair className="h-3 w-3" aria-hidden /></button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-20 items-center gap-2 text-xs font-bold text-red-700"><AlertTriangle className="h-4 w-4" aria-hidden /> Selected photo is unavailable</div>
                    )}
                    {index >= supportingLimit ? <p className="mt-2 text-[10px] font-bold text-amber-900">Saved for another template; not used in this composition.</p> : null}
                  </div>
                ))}
                {Array.from({ length: Math.max(0, supportingLimit - Math.min(selectedSupporting.length, supportingLimit)) }).map((_, index) => (
                  <button key={`empty-${index}`} type="button" onClick={focusPicker} className="flex min-h-24 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-xs font-bold text-muted hover:border-primary/40 hover:text-primary"><ImageIcon className="h-4 w-4" aria-hidden /> Add supporting image</button>
                ))}
              </div>
            </div>

            <div ref={pickerRef} className="mt-5 scroll-mt-6">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Gallery image picker</p>
              {replaceSupportingIndex !== null ? <p className="mt-1 text-xs font-bold text-amber-800">Choose a thumbnail to replace supporting image {replaceSupportingIndex + 1}.</p> : null}
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {gallery.map((image) => {
                  const isPrimary = image.id === primary?.id;
                  const supportIndex = normalized.brochure.supportingMediaIds.indexOf(image.id);
                  return (
                    <div key={image.id} className={`overflow-hidden rounded-xl border bg-white ${isPrimary || supportIndex >= 0 ? "border-primary" : "border-border"}`}>
                      <GalleryThumbnail image={image} className="aspect-[4/3]" />
                      <div className="p-2">
                        <div className="flex items-center gap-1.5">
                          {isPrimary ? <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-white">Main</span> : null}
                          {supportIndex >= 0 ? <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-primary">#{supportIndex + 1}</span> : null}
                          <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-primary">{image.label.en || "Untitled"}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-1">
                          <button type="button" onClick={() => choosePrimary(image.id)} className="rounded border border-border px-1 py-1.5 text-[10px] font-bold text-primary focus-visible:outline-2 focus-visible:outline-primary"><Star className="mx-auto h-3 w-3" aria-hidden /><span className="sr-only">Use {image.label.en} as primary image</span></button>
                          <button type="button" disabled={isPrimary} onClick={() => chooseSupporting(image.id)} aria-pressed={supportIndex >= 0} className="rounded border border-border px-1 py-1.5 text-[10px] font-bold text-primary disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-primary">{supportIndex >= 0 ? "Remove" : replaceSupportingIndex !== null ? "Replace" : "Add"}</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <fieldset className="rounded-2xl border border-border p-4">
            <legend className="px-1 text-sm font-bold text-primary">Content and branding</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold text-primary">
                Branding mode
                <select value={normalized.brandingMode} onChange={(event) => update({ brandingMode: event.target.value as "picchuspot" | "agency" | "unbranded" })} className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm">
                  <option value="picchuspot">PicchuSpot</option><option value="agency">Agency</option><option value="unbranded">Unbranded</option>
                </select>
              </label>
              <label className="text-xs font-bold text-primary">
                Marketing copy
                <select value={normalized.marketingCopyMode} onChange={(event) => update({ marketingCopyMode: event.target.value as "none" | "summary" | "highlights" | "custom" })} className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm">
                  <option value="none">None</option><option value="summary">Short summary</option><option value="highlights">Selected highlights</option><option value="custom">Custom copy</option>
                </select>
              </label>
              {normalized.marketingCopyMode === "custom" ? (
                <label className="text-xs font-bold text-primary sm:col-span-2">Custom marketing copy<textarea value={normalized.customMarketingCopy?.en ?? ""} maxLength={220} onChange={(event) => update({ customMarketingCopy: { ...(normalized.customMarketingCopy ?? { en: "" }), en: event.target.value } })} className="mt-2 min-h-24 w-full rounded-xl border border-border px-3 py-2.5 text-sm" /></label>
              ) : null}
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <fieldset>
                <legend className="text-xs font-bold text-primary">Listing facts</legend>
                <div className="mt-2 space-y-2">
                  {PROPERTY_SOCIAL_CARD_FACT_KEYS.map((key) => (
                    <label key={key} className="flex items-center gap-2 text-xs font-semibold text-primary"><input type="checkbox" checked={normalized.selectedFactKeys.includes(key)} onChange={(event) => { const selected: PropertySocialCardFactKey[] = event.target.checked ? [...normalized.selectedFactKeys, key].slice(0, 4) : normalized.selectedFactKeys.filter((item) => item !== key); update({ selectedFactKeys: selected }); }} className="h-4 w-4 accent-primary" />{PROPERTY_SOCIAL_CARD_FACT_LABELS[key]}</label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-bold text-primary">Highlights</legend>
                <div className="mt-2 space-y-2">
                  {property.highlights.map((highlight, index) => {
                    const id = propertyHighlightId(highlight, index);
                    const label = highlight.text?.en ?? highlight.title?.en ?? `Highlight ${index + 1}`;
                    return <label key={id} className="flex items-start gap-2 text-xs font-semibold text-primary"><input type="checkbox" checked={normalized.selectedHighlightIds.includes(id)} onChange={(event) => { const selected = event.target.checked ? [...normalized.selectedHighlightIds, id].slice(0, 3) : normalized.selectedHighlightIds.filter((item) => item !== id); update({ selectedHighlightIds: selected }); }} className="mt-0.5 h-4 w-4 accent-primary" /><span className="line-clamp-2">{label}</span></label>;
                  })}
                </div>
              </fieldset>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {([[
                "includeAgent", "Realtor details",
              ], ["includeAgencyLogo", "Agency logo"], ["includeQrCode", "Canonical QR code"], ["includeDisclaimer", "Legal disclaimer"]] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-primary"><input type="checkbox" checked={normalized[key]} onChange={(event) => update({ [key]: event.target.checked })} className="h-4 w-4 accent-primary" />{label}</label>
              ))}
            </div>
            {normalized.includeDisclaimer ? <label className="mt-4 block text-xs font-bold text-primary">Disclaimer<textarea value={normalized.disclaimer?.en ?? ""} maxLength={400} placeholder="All information is provided for marketing purposes and should be independently verified." onChange={(event) => update({ disclaimer: { ...(normalized.disclaimer ?? { en: "" }), en: event.target.value } })} className="mt-2 min-h-20 w-full rounded-xl border border-border px-3 py-2.5 text-sm" /></label> : null}
          </fieldset>
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={saving || !changed}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-45 lg:hidden"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : changed ? <Save className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
          {saving ? "Saving…" : changed ? "Save changes" : "Saved"}
        </button>
      </div>
      <footer className="flex items-center gap-2 border-t border-border bg-surface px-5 py-3 text-xs text-muted">
        <FileImage className="h-4 w-4" aria-hidden /> No images are duplicated or re-uploaded. Final downloads remain deterministic and versioned.
        <span className="sr-only">Property slug: {propertySlug}</span>
      </footer>
    </section>
  );
}
