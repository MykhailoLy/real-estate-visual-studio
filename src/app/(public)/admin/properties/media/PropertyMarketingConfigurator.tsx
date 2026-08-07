"use client";
/* eslint-disable @next/next/no-img-element -- Verified Storage originals and generated object URLs must preserve their exact pixels. */

import {
  Crosshair,
  Download,
  ExternalLink,
  FileImage,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Save,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { focalPointToObjectPosition } from "@/features/property-showcase/focal-point";
import {
  PROPERTY_MARKETING_PREVIEW_DEBOUNCE_MS,
  serializePropertyMarketingPreviewRequest,
  shouldApplyPropertyMarketingPreview,
} from "@/features/property-showcase/marketing-preview-client";
import {
  automaticLandscapeBrochure,
  brochureSupportingImageLimit,
  moveBrochureSupportingImage,
  normalizePropertyMarketingMaterialsConfig,
  PROPERTY_MARKETING_MAX_FACTS,
  PROPERTY_MARKETING_MAX_HIGHLIGHTS,
  propertyHighlightId,
  resetPropertyMarketingMaterialsConfig,
  setBrochurePrimaryImage,
  toggleBrochureSupportingImage,
  toCanonicalPropertyMarketingMaterialsConfig,
} from "@/features/property-showcase/marketing-materials";
import {
  PROPERTY_CUSTOM_FLYER_FORMATS,
  type PropertyCustomFlyerFormat,
} from "@/features/property-showcase/custom-flyer";
import {
  PROPERTY_SOCIAL_CARD_FACT_KEYS,
  PROPERTY_SOCIAL_CARD_FACT_LABELS,
} from "@/features/property-showcase/social-card";
import type {
  PropertyCustomFlyerFiles,
  PropertyFlyerMode,
  PropertyGalleryImage,
  PropertyMarketingLandscapeLayout,
  PropertyMarketingMaterialsConfig,
  PropertyShowcase,
  PropertySocialCardFactKey,
} from "@/features/property-showcase/types";
import { SITE_MEDIA_BUCKET } from "@/lib/site-media";
import { getSupabaseBrowser } from "@/lib/supabase";

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

interface SignedUploadInfo {
  bucket: string;
  path: string;
  token: string;
}

type PreviewStatus = "idle" | "updating" | "ready" | "error";

const LANDSCAPE_TEMPLATES = [
  { value: "single-hero", label: "Single Hero", detail: "One immersive property photograph" },
  { value: "hero-two-square", label: "Hero + supporting", detail: "Main image with up to two supporting views" },
  { value: "hero-four-grid", label: "Hero + four grid", detail: "Main image with up to four details" },
] as const;

const FLYER_MODE_CARDS: Array<{
  value: PropertyFlyerMode;
  label: string;
  description: string;
}> = [
  { value: "none", label: "No flyer", description: "Do not show brochure or download actions for this property." },
  { value: "automatic-landscape", label: "Automatic landscape", description: "Generate a branded landscape property flyer from listing information and gallery images." },
  { value: "custom", label: "Custom flyer", description: "Upload a finished brochure created externally in Photoshop, InDesign, Canva, or similar tools." },
];

function templateMiniature(template: PropertyMarketingLandscapeLayout) {
  return (
    <span aria-hidden className="flex h-11 w-20 overflow-hidden rounded-md border border-current/20 bg-[#0B1F3A]">
      <span className={template === "single-hero" ? "w-full bg-[#cfb980]" : "w-3/5 bg-[#cfb980]"} />
      {template !== "single-hero" ? (
        <span className="grid flex-1 gap-px bg-white/90 p-1">
          <span className="bg-slate-300" />
          {template === "hero-four-grid" ? <span className="bg-[#cfb980]" /> : null}
        </span>
      ) : null}
    </span>
  );
}

function GalleryThumbnail({ image }: { image: PropertyGalleryImage }) {
  return (
    <span className="relative block aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
      <img
        src={image.src}
        alt=""
        className="h-full w-full object-cover"
        style={{ objectPosition: focalPointToObjectPosition(image.focalPoint) }}
      />
    </span>
  );
}

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? "Request failed.";
}

async function cleanupFailedUpload(slug: string, publicUrl: string) {
  await fetch("/api/admin/properties/upload-url", {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, publicUrls: [publicUrl] }),
  }).catch(() => undefined);
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
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRetry, setPreviewRetry] = useState(0);
  const [uploadingFormat, setUploadingFormat] = useState<PropertyCustomFlyerFormat | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewAbort = useRef<AbortController | null>(null);
  const previewSequence = useRef(0);
  const primary = gallery.find((image) => image.id === normalized.brochure.primaryMediaId)
    ?? gallery.find((image) => image.src === property.coverImage)
    ?? gallery[0];
  const supportingLimit = brochureSupportingImageLimit(normalized.brochure.template);
  const focalPoints = useMemo(
    () => gallery.map((image) => ({
      mediaId: image.id,
      focalPoint: image.focalPoint ?? { x: 0.5, y: 0.5 },
    })),
    [gallery],
  );
  const previewBody = useMemo(
    () => serializePropertyMarketingPreviewRequest(
      canonical,
      focalPoints,
      { ...property, gallery, marketingMaterials: canonical },
    ),
    [canonical, focalPoints, gallery, property],
  );
  const customPreview = normalized.customFlyer.jpg ?? normalized.customFlyer.png;

  useEffect(() => {
    if (normalized.flyerMode !== "automatic-landscape") {
      previewAbort.current?.abort();
      return;
    }
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
        if (!response.ok) throw new Error(await readError(response));
        const blob = await response.blob();
        if (!shouldApplyPropertyMarketingPreview(sequence, previewSequence.current, controller.signal.aborted)) return;
        const nextUrl = URL.createObjectURL(blob);
        const previous = previewUrlRef.current;
        previewUrlRef.current = nextUrl;
        setPreviewUrl(nextUrl);
        setPreviewStatus("ready");
        if (previous) URL.revokeObjectURL(previous);
      } catch (error) {
        if (!shouldApplyPropertyMarketingPreview(sequence, previewSequence.current, controller.signal.aborted)) return;
        setPreviewStatus("error");
        setPreviewError(error instanceof Error ? error.message : "Could not update the brochure preview.");
      }
    }, PROPERTY_MARKETING_PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [normalized.flyerMode, previewBody, previewRetry, propertyId]);

  useEffect(() => () => {
    previewAbort.current?.abort();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function update(next: Partial<PropertyMarketingMaterialsConfig>) {
    onChange({ ...canonical, ...next });
  }

  function updateBrochure(next: Partial<NonNullable<PropertyMarketingMaterialsConfig["brochure"]>>) {
    onChange({ ...canonical, brochure: { ...normalized.brochure, ...next } });
  }

  function chooseMode(flyerMode: PropertyFlyerMode) {
    if (flyerMode === "automatic-landscape") {
      onChange({
        ...canonical,
        flyerMode,
        enabled: true,
        brochure: automaticLandscapeBrochure(canonical),
      });
      return;
    }
    onChange({ ...canonical, flyerMode, enabled: false });
  }

  async function uploadCustomFlyer(format: PropertyCustomFlyerFormat, file: File) {
    const rule = PROPERTY_CUSTOM_FLYER_FORMATS[format];
    if (file.size === 0 || file.size > rule.maxBytes) {
      throw new Error(`${format.toUpperCase()} files must be no larger than ${rule.maxBytes / (1024 * 1024)} MB.`);
    }
    if (file.type !== rule.mime) throw new Error(`Choose a ${rule.mime} file.`);
    const signedResponse = await fetch("/api/admin/properties/upload-url", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: propertySlug,
        kind: rule.uploadKind,
        filename: file.name,
        content_type: rule.mime,
        file_size: file.size,
      }),
    });
    if (!signedResponse.ok) throw new Error(await readError(signedResponse));
    const signed = await signedResponse.json() as Partial<SignedUploadInfo>;
    if (!signed.path || !signed.token || signed.bucket !== SITE_MEDIA_BUCKET) {
      throw new Error("Could not prepare the flyer upload.");
    }
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.storage.from(SITE_MEDIA_BUCKET).uploadToSignedUrl(
      signed.path,
      signed.token,
      file,
      { contentType: rule.mime, cacheControl: "31536000", upsert: false },
    );
    if (error) throw new Error(`Could not upload ${file.name}.`);
    const { data } = supabase.storage.from(SITE_MEDIA_BUCKET).getPublicUrl(signed.path);
    const publicUrl = data.publicUrl;
    if (!publicUrl) throw new Error("Could not resolve the uploaded flyer URL.");
    const verifyResponse = await fetch(
      `/api/admin/properties/${encodeURIComponent(propertyId)}/flyer/verify`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, path: signed.path }),
      },
    );
    if (!verifyResponse.ok) {
      await cleanupFailedUpload(propertySlug, publicUrl);
      throw new Error(await readError(verifyResponse));
    }
    const verified = await verifyResponse.json() as { publicUrl?: string };
    if (!verified.publicUrl) throw new Error("Could not verify the flyer upload.");
    return verified.publicUrl;
  }

  async function onCustomFileChange(format: PropertyCustomFlyerFormat, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploadingFormat) return;
    setUploadingFormat(format);
    try {
      const url = await uploadCustomFlyer(format, file);
      onChange({
        ...canonical,
        flyerMode: "custom",
        enabled: false,
        customFlyer: { ...normalized.customFlyer, [format]: url },
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not upload the custom flyer.");
    } finally {
      setUploadingFormat(null);
    }
  }

  function removeCustomFile(format: PropertyCustomFlyerFormat) {
    if (!normalized.customFlyer[format]) return;
    if (!window.confirm(`Remove this ${format.toUpperCase()} flyer? Its property-owned Storage object is deleted after you save.`)) return;
    const customFlyer: PropertyCustomFlyerFiles = { ...normalized.customFlyer };
    delete customFlyer[format];
    update({ customFlyer });
  }

  const savedDownload = `/admin/properties/${encodeURIComponent(propertyId)}/materials/brochure.pdf`;

  return (
    <section data-testid="marketing-material-settings" className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">Marketing materials</p>
          <h2 className="mt-1 text-lg font-bold text-primary">7. Property flyer</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">Choose a flyer type. Social sharing previews stay independent.</p>
        </div>
        <button type="button" onClick={() => onChange(resetPropertyMarketingMaterialsConfig())} className="shrink-0 rounded-xl border border-border px-3.5 py-2 text-sm font-bold text-primary hover:border-primary/40">Reset defaults</button>
      </header>

      <div className="space-y-6 p-5">
        <fieldset>
          <legend className="text-sm font-bold text-primary">Choose flyer type</legend>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {FLYER_MODE_CARDS.map((mode) => {
              const selected = normalized.flyerMode === mode.value;
              return <button key={mode.value} type="button" aria-pressed={selected} onClick={() => chooseMode(mode.value)} className={`min-h-32 rounded-2xl border-2 p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/35"}`}><span className="block text-sm font-bold text-primary">{mode.label}</span><span className="mt-2 block text-xs leading-5 text-muted">{mode.description}</span></button>;
            })}
          </div>
        </fieldset>

        {normalized.flyerMode === "none" ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-5 text-sm leading-6 text-muted">
            <p>No public brochure, preview, or download action will be shown. Existing automatic settings and uploaded files remain saved until you explicitly replace or remove them.</p>
            <button type="button" onClick={onSave} disabled={saving || !changed} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-45">{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}{saving ? "Saving…" : changed ? "Save flyer setting" : "Saved"}</button>
          </div>
        ) : null}

        {normalized.flyerMode === "custom" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="rounded-2xl border border-border p-4">
              <h3 className="text-sm font-bold text-primary">Custom property flyer</h3>
              <p className="mt-1 text-xs leading-5 text-muted">Original files are stored unchanged. JPG is preferred for the public preview, then PNG; a PDF-only flyer uses a document card.</p>
              <div className="mt-5 space-y-3">
                {(["pdf", "jpg", "png"] as const).map((format) => {
                  const rule = PROPERTY_CUSTOM_FLYER_FORMATS[format];
                  const uploaded = Boolean(normalized.customFlyer[format]);
                  const busy = uploadingFormat === format;
                  return <div key={format} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-primary/5 text-primary">{format === "pdf" ? <FileText className="h-5 w-5" aria-hidden /> : <FileImage className="h-5 w-5" aria-hidden />}</span><span className="min-w-28 flex-1"><span className="block text-sm font-bold text-primary">{format.toUpperCase()}</span><span className="block text-xs text-muted">{uploaded ? "Uploaded" : "Missing"} · max {rule.maxBytes / (1024 * 1024)} MB</span></span><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-primary"><Upload className="h-3.5 w-3.5" aria-hidden />{busy ? "Uploading…" : uploaded ? "Replace" : "Upload"}<input className="sr-only" type="file" accept={rule.mime} disabled={Boolean(uploadingFormat)} onChange={(event) => void onCustomFileChange(format, event)} /></label>{uploaded ? <button type="button" onClick={() => removeCustomFile(format)} disabled={Boolean(uploadingFormat)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" aria-hidden />Remove</button> : null}</div>;
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="text-sm font-bold text-primary">Preview</h3>
              <div className="mt-4 flex min-h-64 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {customPreview ? <img src={customPreview} alt="Uploaded custom property flyer" className="h-full w-full object-contain" /> : normalized.customFlyer.pdf ? <div className="flex flex-col items-center gap-3 px-5 text-center text-primary"><FileText className="h-12 w-12 text-secondary" aria-hidden /><span className="text-sm font-bold">PDF brochure ready to download</span></div> : <div className="flex flex-col items-center gap-3 px-5 text-center text-muted"><ImageIcon className="h-8 w-8" aria-hidden /><span className="text-sm font-bold">Upload a JPG, PNG, or PDF</span></div>}
              </div>
              <button type="button" onClick={onSave} disabled={saving || !changed || Boolean(uploadingFormat)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-45">{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}{saving ? "Saving…" : changed ? "Save custom flyer" : "Saved"}</button>
            </div>
          </div>
        ) : null}

        {normalized.flyerMode === "automatic-landscape" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)] lg:items-start">
            <div className="space-y-6">
              <fieldset>
                <legend className="text-sm font-bold text-primary">Automatic landscape</legend>
                <p className="mt-1 text-xs leading-5 text-muted">Generate a branded landscape flyer from this listing. Choose the composition and gallery images below.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {LANDSCAPE_TEMPLATES.map((template) => { const selected = normalized.brochure.template === template.value; return <button key={template.value} type="button" aria-pressed={selected} onClick={() => updateBrochure({ orientation: "landscape", template: template.value })} className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/35"}`}>{templateMiniature(template.value)}<span><span className="block text-sm font-bold text-primary">{template.label}</span><span className="mt-1 block text-xs leading-4 text-muted">{template.detail}</span></span></button>; })}
                </div>
              </fieldset>

              <fieldset className="rounded-2xl border border-border p-4">
                <legend className="px-1 text-sm font-bold text-primary">Photos</legend>
                <p className="mt-1 text-xs leading-5 text-muted">The primary image and supporting order are used exactly as selected. Focal-point controls apply to every crop.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {gallery.map((image) => {
                    const primaryImage = image.id === primary?.id;
                    const supportIndex = normalized.brochure.supportingMediaIds.indexOf(image.id);
                    return <div key={image.id} className={`overflow-hidden rounded-xl border bg-white ${primaryImage || supportIndex >= 0 ? "border-primary" : "border-border"}`}><GalleryThumbnail image={image} /><div className="p-3"><div className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 truncate text-xs font-bold text-primary">{image.label.en || "Untitled image"}</span>{primaryImage ? <span className="rounded-full bg-primary px-2 py-1 text-[9px] font-bold text-white">Main</span> : supportIndex >= 0 ? <span className="rounded-full bg-secondary px-2 py-1 text-[9px] font-bold text-primary">#{supportIndex + 1}</span> : null}</div><div className="mt-3 grid grid-cols-3 gap-1"><button type="button" onClick={() => updateBrochure(setBrochurePrimaryImage(normalized.brochure, image.id))} className="min-h-9 rounded border border-border text-[10px] font-bold text-primary"><Star className="mx-auto h-3 w-3" aria-hidden /><span className="sr-only">Set primary</span></button><button type="button" disabled={primaryImage} onClick={() => updateBrochure(toggleBrochureSupportingImage(normalized.brochure, image.id))} className="min-h-9 rounded border border-border px-1 text-[10px] font-bold text-primary disabled:opacity-30">{supportIndex >= 0 ? "Remove" : "Add"}</button><button type="button" onClick={() => onEditFocalPoint(image.id)} className="min-h-9 rounded border border-border text-primary"><Crosshair className="mx-auto h-3.5 w-3.5" aria-hidden /><span className="sr-only">Edit focal point</span></button></div></div></div>;
                  })}
                </div>
                {normalized.brochure.supportingMediaIds.length > 0 ? <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wide text-primary">Supporting image order · up to {supportingLimit} shown</p><div className="mt-2 flex flex-wrap gap-2">{normalized.brochure.supportingMediaIds.map((id, index) => { const image = gallery.find((candidate) => candidate.id === id); return <span key={id} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs font-bold text-primary"><span>{index + 1}. {image?.label.en || "Unavailable image"}</span><button type="button" aria-label="Move supporting image earlier" disabled={index === 0} onClick={() => updateBrochure(moveBrochureSupportingImage(normalized.brochure, id, -1))} className="rounded px-1 disabled:opacity-30">←</button><button type="button" aria-label="Move supporting image later" disabled={index === normalized.brochure.supportingMediaIds.length - 1} onClick={() => updateBrochure(moveBrochureSupportingImage(normalized.brochure, id, 1))} className="rounded px-1 disabled:opacity-30">→</button></span>; })}</div></div> : null}
              </fieldset>

              <fieldset className="rounded-2xl border border-border p-4">
                <legend className="px-1 text-sm font-bold text-primary">Branding and content</legend>
                <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-primary">Branding mode<select value={normalized.brandingMode} onChange={(event) => update({ brandingMode: event.target.value as "picchuspot" | "agency" | "unbranded" })} className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"><option value="picchuspot">PicchuSpot</option><option value="agency">Agency</option><option value="unbranded">Unbranded</option></select></label><label className="text-xs font-bold text-primary">Marketing copy<select value={normalized.marketingCopyMode} onChange={(event) => update({ marketingCopyMode: event.target.value as "none" | "summary" | "highlights" | "custom" })} className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"><option value="none">None</option><option value="summary">Short summary</option><option value="highlights">Selected highlights</option><option value="custom">Custom copy</option></select></label>{normalized.marketingCopyMode === "custom" ? <label className="text-xs font-bold text-primary sm:col-span-2">Custom marketing copy<textarea value={normalized.customMarketingCopy?.en ?? ""} maxLength={220} onChange={(event) => update({ customMarketingCopy: { ...(normalized.customMarketingCopy ?? { en: "" }), en: event.target.value } })} className="mt-2 min-h-24 w-full rounded-xl border border-border px-3 py-2.5 text-sm" /></label> : null}</div>
                <div className="mt-5 grid gap-5 sm:grid-cols-2"><fieldset><legend className="text-xs font-bold text-primary">Listing facts</legend><div className="mt-2 space-y-2">{PROPERTY_SOCIAL_CARD_FACT_KEYS.map((key) => <label key={key} className="flex items-center gap-2 text-xs font-semibold text-primary"><input type="checkbox" checked={normalized.selectedFactKeys.includes(key)} onChange={(event) => update({ selectedFactKeys: event.target.checked ? [...normalized.selectedFactKeys, key].slice(0, PROPERTY_MARKETING_MAX_FACTS) : normalized.selectedFactKeys.filter((item) => item !== key) as PropertySocialCardFactKey[] })} className="h-4 w-4 accent-primary" />{PROPERTY_SOCIAL_CARD_FACT_LABELS[key]}</label>)}</div></fieldset><fieldset><legend className="text-xs font-bold text-primary">Highlights</legend><div className="mt-2 space-y-2">{property.highlights.map((highlight, index) => { const id = propertyHighlightId(highlight, index); const label = highlight.text?.en ?? highlight.title?.en ?? `Highlight ${index + 1}`; return <label key={id} className="flex items-start gap-2 text-xs font-semibold text-primary"><input type="checkbox" checked={normalized.selectedHighlightIds.includes(id)} onChange={(event) => update({ selectedHighlightIds: event.target.checked ? [...normalized.selectedHighlightIds, id].slice(0, PROPERTY_MARKETING_MAX_HIGHLIGHTS) : normalized.selectedHighlightIds.filter((item) => item !== id) })} className="mt-0.5 h-4 w-4 accent-primary" /><span className="line-clamp-2">{label}</span></label>; })}</div></fieldset></div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">{([["includeAgent", "Realtor details"], ["includeAgencyLogo", "Agency logo"], ["includeQrCode", "Canonical QR code"], ["includeDisclaimer", "Legal disclaimer"]] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-primary"><input type="checkbox" checked={normalized[key]} onChange={(event) => update({ [key]: event.target.checked })} className="h-4 w-4 accent-primary" />{label}</label>)}</div>
                {normalized.includeDisclaimer ? <label className="mt-4 block text-xs font-bold text-primary">Disclaimer<textarea value={normalized.disclaimer?.en ?? ""} maxLength={400} onChange={(event) => update({ disclaimer: { ...(normalized.disclaimer ?? { en: "" }), en: event.target.value } })} className="mt-2 min-h-20 w-full rounded-xl border border-border px-3 py-2.5 text-sm" /></label> : null}
              </fieldset>
            </div>

            <aside className="lg:sticky lg:top-5">
              <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-primary">Live flyer preview</h3><p className="mt-1 text-xs text-muted">Uses unsaved values and the final landscape renderer.</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${changed ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{saving ? "Saving…" : changed ? "Unsaved changes" : "Saved"}</span></div><div className="relative mt-4 flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">{previewUrl ? <img src={previewUrl} alt="Unsaved landscape property flyer preview" className="h-full w-full object-contain" /> : <div className="flex flex-col items-center gap-3 px-6 text-center text-primary"><Loader2 className="h-7 w-7 animate-spin" aria-hidden /><span className="text-sm font-bold">Preparing preview…</span></div>}{previewStatus === "updating" && previewUrl ? <span className="absolute inset-x-3 bottom-3 inline-flex items-center justify-center gap-2 rounded-lg bg-black/70 px-3 py-2 text-xs font-bold text-white"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />Updating preview…</span> : null}</div><div aria-live="polite" className="mt-3 min-h-5 text-xs text-muted">{previewStatus === "error" ? `Preview failed — ${previewError ?? "Retry."}` : previewStatus === "ready" ? "Preview reflects unsaved changes." : "Waiting to render preview…"}</div>{previewStatus === "error" ? <button type="button" onClick={() => setPreviewRetry((current) => current + 1)} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-800"><RefreshCw className="h-3.5 w-3.5" aria-hidden />Retry preview</button> : null}<div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" disabled={!previewUrl} onClick={() => previewUrl && window.open(previewUrl, "_blank", "noopener,noreferrer")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-bold text-primary disabled:opacity-40"><ExternalLink className="h-4 w-4" aria-hidden />Open preview</button><a href={savedDownload} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-center text-sm font-bold text-primary"><Download className="h-4 w-4" aria-hidden />Test saved PDF</a></div><button type="button" onClick={onSave} disabled={saving || !changed} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-45">{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}{saving ? "Saving…" : changed ? "Save flyer" : "Saved"}</button></div>
            </aside>
          </div>
        ) : null}
      </div>
      <footer className="flex items-center gap-2 border-t border-border bg-surface px-5 py-3 text-xs text-muted"><FileImage className="h-4 w-4" aria-hidden />Automatic files stay deterministic and versioned; custom files stay in their original uploaded format.<span className="sr-only">Property slug: {propertySlug}</span></footer>
    </section>
  );
}
