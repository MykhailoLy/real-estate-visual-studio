"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Save,
  Sparkles,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import type { PropertyShowcaseAdminRecord } from "@/features/property-showcase/admin-types";
import {
  propertyPreviewHref,
  resolvePropertySelection,
} from "@/features/property-showcase/admin-routing";
import {
  formatImageBytes,
  optimizePropertyImage,
} from "@/features/property-showcase/client-image-optimizer";
import type {
  PropertyGalleryImage,
  PropertyShowcase,
} from "@/features/property-showcase/types";
import { SITE_MEDIA_BUCKET } from "@/lib/site-media";
import { getSupabaseBrowser } from "@/lib/supabase";

const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_SOURCE_MB = MAX_SOURCE_BYTES / (1024 * 1024);
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_MIMES)[number];
type UploadKind = "gallery" | "floor-plan" | "tour-poster";

interface Props {
  records: PropertyShowcaseAdminRecord[];
  schemaReady: boolean;
  initialPropertyId: string;
}

interface SignedUploadInfo {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
}

interface SavingsSummary {
  count: number;
  originalBytes: number;
  optimizedBytes: number;
}

function isAllowedMime(value: string): value is AllowedMime {
  return (ALLOWED_MIMES as readonly string[]).includes(value);
}

function inferMime(file: File): AllowedMime | null {
  if (isAllowedMime(file.type)) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return null;
}

function validateSourceFile(file: File): string | null {
  if (file.size <= 0) return `${file.name} appears to be empty.`;
  if (file.size > MAX_SOURCE_BYTES) {
    return `${file.name} is larger than ${MAX_SOURCE_MB} MB.`;
  }
  if (!inferMime(file)) return `${file.name}: use JPG, PNG, or WebP.`;
  return null;
}

function isDemoAsset(src: string): boolean {
  return src.startsWith("/property-demo/");
}

function displayName(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function savingsPercent(summary: SavingsSummary): number {
  if (summary.originalBytes <= 0) return 0;
  return Math.max(
    0,
    Math.round(
      ((summary.originalBytes - summary.optimizedBytes) / summary.originalBytes) * 100,
    ),
  );
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "Request failed.";
  } catch {
    return "Request failed.";
  }
}

async function uploadPropertyFile(
  slug: string,
  file: File,
  kind: UploadKind,
): Promise<{ path: string; publicUrl: string }> {
  const contentType = inferMime(file);
  if (!contentType) throw new Error("Unsupported optimized file type.");

  const response = await fetch("/api/admin/properties/upload-url", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug,
      kind,
      filename: file.name,
      content_type: contentType,
      file_size: file.size,
    }),
  });

  if (!response.ok) throw new Error(await readError(response));
  const signed = (await response.json()) as Partial<SignedUploadInfo>;
  if (!signed.bucket || !signed.path || !signed.token || !signed.signedUrl) {
    throw new Error("Could not prepare the upload.");
  }
  if (signed.bucket !== SITE_MEDIA_BUCKET) {
    throw new Error("Upload returned the wrong storage bucket.");
  }

  const supabase = getSupabaseBrowser();
  const { error } = await supabase.storage
    .from(SITE_MEDIA_BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    console.warn("property-showcase: optimized upload failed", error);
    throw new Error(`Could not upload ${file.name}.`);
  }

  const { data } = supabase.storage.from(SITE_MEDIA_BUCKET).getPublicUrl(signed.path);
  if (!data.publicUrl) throw new Error("Could not resolve the uploaded image URL.");
  return { path: signed.path, publicUrl: data.publicUrl };
}

export default function OptimizedPropertyMediaManagerClient({
  records,
  schemaReady,
  initialPropertyId,
}: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(initialPropertyId);
  const [requestedId, setRequestedId] = useState(initialPropertyId);
  const selection = useMemo(
    () => resolvePropertySelection(records, selectedId, requestedId),
    [records, selectedId, requestedId],
  );
  const selected = selection.selected;

  if (!schemaReady) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        The property showcase database table is not ready.
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
        <ImageIcon className="mx-auto h-10 w-10 text-muted" aria-hidden />
        <h2 className="mt-4 text-lg font-bold text-primary">Create a property draft first</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
          Save the listing information in Properties. After the draft exists, its photos and floor plan can be uploaded here.
        </p>
        <Link
          href="/admin/properties"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white"
        >
          Back to properties
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <label className="block min-w-0 flex-1 text-sm font-semibold text-foreground">
          Property
          <select
            value={selected?.id ?? ""}
            onChange={(event) => {
              const nextId = event.target.value;
              setSelectedId(nextId);
              setRequestedId(nextId);
              router.replace(`/admin/properties/media?property=${encodeURIComponent(nextId)}`);
            }}
            className="mt-1.5 w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            {selection.missingRequestedProperty ? (
              <option value="">Property not found</option>
            ) : null}
            {records.map((record) => (
              <option key={record.id} value={record.id}>
                {record.property.title.en} · /property/{record.slug}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/properties"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-primary hover:border-primary/40"
          >
            Back to details
          </Link>
          {selected?.published ? (
            <Link
              href={`/property/${selected.slug}`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-primary hover:border-primary/40"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open page
            </Link>
          ) : null}
          {selected ? (
            <Link
              href={propertyPreviewHref(selected.id)}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-primary hover:border-primary/40"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Preview draft
            </Link>
          ) : null}
        </div>
      </div>

      {selection.missingRequestedProperty ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-800">
          Property <span className="font-mono">{selection.requestedId}</span>{" "}
          was not found. Choose a property from the list, or return to Properties.
        </div>
      ) : null}

      {selected ? <PropertyMediaEditor key={selected.id} record={selected} /> : null}
    </div>
  );
}

function PropertyMediaEditor({ record }: { record: PropertyShowcaseAdminRecord }) {
  const router = useRouter();
  const initialGallery = [...record.property.gallery].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const [gallery, setGallery] = useState<PropertyGalleryImage[]>(initialGallery);
  const [coverImage, setCoverImage] = useState(record.property.coverImage);
  const [floorPlanUrl, setFloorPlanUrl] = useState(
    record.property.floorPlans[0]?.imageUrl ?? "",
  );
  const [tourPosterUrl, setTourPosterUrl] = useState(
    record.property.virtualTour?.posterImage ?? "",
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDetail, setUploadDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSavings, setLastSavings] = useState<SavingsSummary | null>(null);

  const realGallery = gallery.filter((item) => !isDemoAsset(item.src));

  function normalize(items: PropertyGalleryImage[]): PropertyGalleryImage[] {
    return items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
  }

  function move(imageId: string, direction: -1 | 1) {
    setGallery((current) => {
      const index = current.findIndex((item) => item.id === imageId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return normalize(next);
    });
  }

  function dropOn(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setGallery((current) => {
      const from = current.findIndex((item) => item.id === draggedId);
      const to = current.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return normalize(next);
    });
    setDraggedId(null);
  }

  function removeImage(imageId: string) {
    if (
      !window.confirm(
        "Remove this photo from the property page? The Storage file will not be deleted.",
      )
    ) {
      return;
    }

    setGallery((current) => {
      const removed = current.find((item) => item.id === imageId);
      const next = current.filter((item) => item.id !== imageId);
      if (removed && coverImage === removed.src) {
        setCoverImage(next[0]?.src ?? "");
      }
      return normalize(next);
    });
  }

  async function uploadGallery(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length === 0 || uploading) return;

    const validation = files.map(validateSourceFile).find(Boolean);
    if (validation) {
      setError(validation);
      return;
    }

    setUploading(true);
    setError(null);
    setNotice(null);
    setLastSavings(null);

    try {
      let next = gallery.filter((item) => !isDemoAsset(item.src));
      let nextCover = isDemoAsset(coverImage) ? "" : coverImage;
      let originalBytes = 0;
      let optimizedBytes = 0;

      for (let index = 0; index < files.length; index += 1) {
        const sourceFile = files[index];
        setUploadDetail(
          `Optimizing ${index + 1} of ${files.length}: ${sourceFile.name}`,
        );
        const optimized = await optimizePropertyImage(sourceFile, "gallery");
        originalBytes += optimized.originalBytes;
        optimizedBytes += optimized.optimizedBytes;
        setUploadDetail(
          `Uploading ${index + 1} of ${files.length}: ${formatImageBytes(optimized.originalBytes)} → ${formatImageBytes(optimized.optimizedBytes)} (${optimized.width} × ${optimized.height})`,
        );
        const uploaded = await uploadPropertyFile(
          record.slug,
          optimized.file,
          "gallery",
        );
        const label = displayName(sourceFile.name) || `Photo ${next.length + 1}`;
        const item: PropertyGalleryImage = {
          id: `gallery-${crypto.randomUUID()}`,
          src: uploaded.publicUrl,
          alt: { en: `${record.property.title.en} — ${label}` },
          label: { en: label },
          sortOrder: next.length + 1,
        };
        next = [...next, item];
        if (!nextCover) nextCover = uploaded.publicUrl;
      }

      const summary = { count: files.length, originalBytes, optimizedBytes };
      setGallery(normalize(next));
      setCoverImage(nextCover);
      setLastSavings(summary);
      setNotice(
        `${files.length} photo${files.length === 1 ? "" : "s"} optimized and uploaded. ${formatImageBytes(originalBytes)} → ${formatImageBytes(optimizedBytes)} (${savingsPercent(summary)}% saved).`,
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Photo upload failed.",
      );
    } finally {
      setUploading(false);
      setUploadDetail("");
    }
  }

  async function uploadFloorPlan(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const sourceFile = input.files?.[0] ?? null;
    input.value = "";
    if (!sourceFile || uploading) return;
    const validation = validateSourceFile(sourceFile);
    if (validation) {
      setError(validation);
      return;
    }

    setUploading(true);
    setUploadDetail(`Optimizing floor plan: ${sourceFile.name}`);
    setError(null);
    setNotice(null);
    setLastSavings(null);
    try {
      const optimized = await optimizePropertyImage(sourceFile, "floor-plan");
      setUploadDetail(
        `Uploading floor plan: ${formatImageBytes(optimized.originalBytes)} → ${formatImageBytes(optimized.optimizedBytes)} (${optimized.width} × ${optimized.height})`,
      );
      const uploaded = await uploadPropertyFile(
        record.slug,
        optimized.file,
        "floor-plan",
      );
      setFloorPlanUrl(uploaded.publicUrl);
      const summary = {
        count: 1,
        originalBytes: optimized.originalBytes,
        optimizedBytes: optimized.optimizedBytes,
      };
      setLastSavings(summary);
      setNotice(
        `Floor plan optimized and uploaded. ${formatImageBytes(optimized.originalBytes)} → ${formatImageBytes(optimized.optimizedBytes)} (${optimized.savedPercent}% saved).`,
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Floor plan upload failed.",
      );
    } finally {
      setUploading(false);
      setUploadDetail("");
    }
  }

  async function uploadTourPoster(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const sourceFile = input.files?.[0] ?? null;
    input.value = "";
    if (!sourceFile || uploading) return;
    const validation = validateSourceFile(sourceFile);
    if (validation) {
      setError(validation);
      return;
    }

    setUploading(true);
    setUploadDetail(`Optimizing tour poster: ${sourceFile.name}`);
    setError(null);
    setNotice(null);
    setLastSavings(null);
    try {
      const optimized = await optimizePropertyImage(sourceFile, "gallery");
      setUploadDetail(
        `Uploading tour poster: ${formatImageBytes(optimized.originalBytes)} → ${formatImageBytes(optimized.optimizedBytes)} (${optimized.width} × ${optimized.height})`,
      );
      const uploaded = await uploadPropertyFile(
        record.slug,
        optimized.file,
        "tour-poster",
      );
      setTourPosterUrl(uploaded.publicUrl);
      const summary = {
        count: 1,
        originalBytes: optimized.originalBytes,
        optimizedBytes: optimized.optimizedBytes,
      };
      setLastSavings(summary);
      setNotice(
        `Tour poster optimized and uploaded. ${formatImageBytes(optimized.originalBytes)} → ${formatImageBytes(optimized.optimizedBytes)} (${optimized.savedPercent}% saved).`,
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Tour poster upload failed.",
      );
    } finally {
      setUploading(false);
      setUploadDetail("");
    }
  }

  async function save() {
    if (saving || uploading) return;
    const cleanedGallery = normalize(
      gallery.filter((item) => !isDemoAsset(item.src)),
    );
    const finalCover =
      coverImage && !isDemoAsset(coverImage)
        ? coverImage
        : cleanedGallery[0]?.src ?? record.property.coverImage;

    if (cleanedGallery.length === 0) {
      setError("Upload at least one real property photo before saving media.");
      return;
    }

    const existingPlan = record.property.floorPlans[0];
    const floorPlans: PropertyShowcase["floorPlans"] = floorPlanUrl
      ? [
          {
            id: existingPlan?.id ?? "main-floor",
            title: existingPlan?.title ?? {
              en: "Main floor",
              es: "Planta principal",
            },
            imageUrl: floorPlanUrl,
            downloadUrl: floorPlanUrl,
            interactiveUrl: existingPlan?.interactiveUrl,
            sortOrder: 1,
          },
          ...record.property.floorPlans.slice(1),
        ]
      : record.property.floorPlans;

    const property: PropertyShowcase = {
      ...record.property,
      coverImage: finalCover,
      gallery: cleanedGallery,
      floorPlans,
      virtualTour: record.property.virtualTour
        ? {
            ...record.property.virtualTour,
            posterImage:
              tourPosterUrl && !isDemoAsset(tourPosterUrl)
                ? tourPosterUrl
                : !record.property.virtualTour.posterImage ||
                    isDemoAsset(record.property.virtualTour.posterImage)
                  ? finalCover
                  : record.property.virtualTour.posterImage,
          }
        : undefined,
    };

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/properties/${record.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property,
          published: record.published,
          updateMode: "media",
        }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setGallery(cleanedGallery);
      setCoverImage(finalCover);
      setNotice("Property media saved successfully.");
      router.refresh();
    } catch {
      setError("Network error while saving property media.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
        <span className="font-bold">Automatic optimization is active.</span>{" "}
        Gallery photos are converted to WebP and limited to 2800 px. Floor plans use a sharper 4000 px profile. Original files stay on your computer.
      </div>

      {notice ? (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {lastSavings ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm text-primary">
          <span className="inline-flex items-center gap-2 font-bold">
            <Sparkles className="h-4 w-4" aria-hidden /> Storage saved
          </span>
          <span>{formatImageBytes(lastSavings.originalBytes)} original</span>
          <span>→ {formatImageBytes(lastSavings.optimizedBytes)} uploaded</span>
          <span className="font-bold">−{savingsPercent(lastSavings)}%</span>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-primary">Photo gallery</h2>
            <p className="mt-1 text-sm text-muted">
              Upload several source photos at once. They are optimized locally before Supabase receives them.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-light">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4" aria-hidden />
            )}
            {uploading ? "Optimizing…" : "Upload photos"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              multiple
              disabled={uploading || saving}
              onChange={uploadGallery}
              className="sr-only"
            />
          </label>
        </header>

        {uploading && uploadDetail ? (
          <div className="border-b border-border bg-surface px-5 py-3 text-xs font-medium text-muted">
            {uploadDetail}
          </div>
        ) : null}

        <div className="p-5">
          {gallery.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-sm text-muted">
              No photos yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {gallery.map((image, index) => {
                const isCover = image.src === coverImage;
                const demo = isDemoAsset(image.src);
                return (
                  <article
                    key={image.id}
                    draggable={!demo}
                    onDragStart={() => setDraggedId(image.id)}
                    onDragEnd={() => setDraggedId(null)}
                    onDragOver={(event: DragEvent<HTMLElement>) =>
                      event.preventDefault()
                    }
                    onDrop={() => dropOn(image.id)}
                    className={`overflow-hidden rounded-2xl border bg-white transition ${
                      draggedId === image.id
                        ? "border-primary opacity-55"
                        : "border-border"
                    }`}
                  >
                    <div className="relative aspect-[4/3] bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.src}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
                          {index + 1}
                        </span>
                        {isCover ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[10px] font-bold text-primary-dark">
                            <Star className="h-3 w-3" aria-hidden /> Cover
                          </span>
                        ) : null}
                        {demo ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-900">
                            Demo placeholder
                          </span>
                        ) : null}
                      </div>
                      {!demo ? (
                        <div className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
                          <GripVertical className="h-4 w-4" aria-hidden />
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-3 p-3">
                      <input
                        value={image.label.en}
                        onChange={(event) =>
                          setGallery((current) =>
                            current.map((item) =>
                              item.id === image.id
                                ? {
                                    ...item,
                                    label: {
                                      ...item.label,
                                      en: event.target.value,
                                    },
                                    alt: {
                                      ...item.alt,
                                      en: `${record.property.title.en} — ${event.target.value}`,
                                    },
                                  }
                                : item,
                            ),
                          )
                        }
                        className="w-full rounded-lg border border-border px-2.5 py-2 text-xs font-semibold outline-none focus:border-primary"
                        aria-label={`Label for photo ${index + 1}`}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCoverImage(image.src)}
                          disabled={demo}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-primary disabled:opacity-40"
                        >
                          <Star className="h-3.5 w-3.5" aria-hidden /> Set cover
                        </button>
                        <button
                          type="button"
                          onClick={() => move(image.id, -1)}
                          disabled={index === 0}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-primary disabled:opacity-30"
                          aria-label="Move photo left"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(image.id, 1)}
                          disabled={index === gallery.length - 1}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-primary disabled:opacity-30"
                          aria-label="Move photo right"
                        >
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(image.id)}
                          className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                          aria-label="Remove photo"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <p className="mt-4 text-xs text-muted">
            {realGallery.length} optimized photo
            {realGallery.length === 1 ? "" : "s"}. Removing a saved photo from the page does not yet delete its old Storage object automatically.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-primary">Floor plan</h2>
            <p className="mt-1 text-sm text-muted">
              Uses a sharper WebP profile up to 4000 px so room labels remain readable.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-primary hover:border-primary/40">
            <Upload className="h-4 w-4" aria-hidden /> Upload floor plan
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              disabled={uploading || saving}
              onChange={uploadFloorPlan}
              className="sr-only"
            />
          </label>
        </header>
        <div className="p-5">
          {floorPlanUrl ? (
            <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={floorPlanUrl}
                alt="Floor plan preview"
                className="mx-auto max-h-[560px] w-full object-contain"
              />
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Remove this floor plan from the property page? The Storage file will not be deleted.",
                    )
                  ) {
                    setFloorPlanUrl("");
                  }
                }}
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/65 text-white"
                aria-label="Remove floor plan"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-sm text-muted">
              No floor plan uploaded.
            </div>
          )}
        </div>
      </section>

      {record.property.virtualTour ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-primary">360 tour poster</h2>
              <p className="mt-1 text-sm text-muted">
                Shown before the external tour loads, and used when a provider opens in a new tab.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-primary hover:border-primary/40">
              <Upload className="h-4 w-4" aria-hidden /> Upload poster
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                disabled={uploading || saving}
                onChange={uploadTourPoster}
                className="sr-only"
              />
            </label>
          </header>
          <div className="p-5">
            {tourPosterUrl ? (
              <div className="relative overflow-hidden rounded-2xl border border-border bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tourPosterUrl}
                  alt="360 tour poster preview"
                  className="aspect-video w-full object-cover"
                />
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-sm text-muted">
                No tour poster uploaded.
              </div>
            )}
          </div>
        </section>
      ) : null}

      <div className="sticky bottom-4 z-20 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving || uploading}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          {saving ? "Saving…" : "Save media changes"}
        </button>
      </div>
    </div>
  );
}
