"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Save,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import type { PropertyShowcaseAdminRecord } from "@/features/property-showcase/admin-types";
import type {
  PropertyGalleryImage,
  PropertyShowcase,
} from "@/features/property-showcase/types";
import { SITE_MEDIA_BUCKET } from "@/lib/site-media";
import { getSupabaseBrowser } from "@/lib/supabase";

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_MB = MAX_BYTES / (1024 * 1024);
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_MIMES)[number];
type UploadKind = "gallery" | "floor-plan" | "tour-poster";

interface Props {
  records: PropertyShowcaseAdminRecord[];
  schemaReady: boolean;
}

interface SignedUploadInfo {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
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

function validateFile(file: File): string | null {
  if (file.size <= 0) return `${file.name} appears to be empty.`;
  if (file.size > MAX_BYTES) return `${file.name} is larger than ${MAX_MB} MB.`;
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
  if (!contentType) throw new Error("Unsupported file type. Use JPG, PNG, or WebP.");

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
    console.warn("property-showcase: upload failed", error);
    throw new Error(`Could not upload ${file.name}.`);
  }

  const { data } = supabase.storage.from(SITE_MEDIA_BUCKET).getPublicUrl(signed.path);
  if (!data.publicUrl) throw new Error("Could not resolve the uploaded image URL.");
  return { path: signed.path, publicUrl: data.publicUrl };
}

export default function PropertyMediaManagerClient({ records, schemaReady }: Props) {
  const [selectedId, setSelectedId] = useState(records[0]?.id ?? "");
  const selected = useMemo(
    () => records.find((record) => record.id === selectedId) ?? records[0] ?? null,
    [records, selectedId],
  );

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
            onChange={(event) => setSelectedId(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
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
        </div>
      </div>

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
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDetail, setUploadDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setGallery((current) => {
      const next = current.filter((item) => item.id !== imageId);
      if (coverImage === current.find((item) => item.id === imageId)?.src) {
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

    const validation = files.map(validateFile).find(Boolean);
    if (validation) {
      setError(validation);
      return;
    }

    setUploading(true);
    setError(null);
    setNotice(null);

    try {
      let next = gallery.filter((item) => !isDemoAsset(item.src));
      let nextCover = isDemoAsset(coverImage) ? "" : coverImage;

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setUploadDetail(`${index + 1} of ${files.length}: ${file.name}`);
        const uploaded = await uploadPropertyFile(record.slug, file, "gallery");
        const label = displayName(file.name) || `Photo ${next.length + 1}`;
        const item: PropertyGalleryImage = {
          id: `gallery-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
          src: uploaded.publicUrl,
          alt: { en: `${record.property.title.en} — ${label}` },
          label: { en: label },
          sortOrder: next.length + 1,
        };
        next = [...next, item];
        if (!nextCover) nextCover = uploaded.publicUrl;
      }

      setGallery(normalize(next));
      setCoverImage(nextCover);
      setNotice(`${files.length} photo${files.length === 1 ? "" : "s"} uploaded. Save media changes to publish the new order.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Photo upload failed.");
    } finally {
      setUploading(false);
      setUploadDetail("");
    }
  }

  async function uploadFloorPlan(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    input.value = "";
    if (!file || uploading) return;
    const validation = validateFile(file);
    if (validation) {
      setError(validation);
      return;
    }

    setUploading(true);
    setUploadDetail(file.name);
    setError(null);
    setNotice(null);
    try {
      const uploaded = await uploadPropertyFile(record.slug, file, "floor-plan");
      setFloorPlanUrl(uploaded.publicUrl);
      setNotice("Floor plan uploaded. Save media changes to connect it to the property page.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Floor plan upload failed.");
    } finally {
      setUploading(false);
      setUploadDetail("");
    }
  }

  async function save() {
    if (saving || uploading) return;
    const cleanedGallery = normalize(gallery.filter((item) => !isDemoAsset(item.src)));
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
            title: existingPlan?.title ?? { en: "Main floor", es: "Planta principal" },
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
              !record.property.virtualTour.posterImage ||
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
        body: JSON.stringify({ property, published: record.published }),
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

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-primary">Photo gallery</h2>
            <p className="mt-1 text-sm text-muted">
              Upload several photos at once. Drag cards to reorder, or use the arrow buttons on mobile.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-light">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
            {uploading ? "Uploading…" : "Upload photos"}
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
                    onDragOver={(event: DragEvent<HTMLElement>) => event.preventDefault()}
                    onDrop={() => dropOn(image.id)}
                    className={`overflow-hidden rounded-2xl border bg-white transition ${
                      draggedId === image.id ? "border-primary opacity-55" : "border-border"
                    }`}
                  >
                    <div className="relative aspect-[4/3] bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.src} alt="" className="h-full w-full object-cover" />
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
                                    label: { ...item.label, en: event.target.value },
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
                          <Star className="h-3.5 w-3.5" aria-hidden />
                          Set cover
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
            {realGallery.length} real photo{realGallery.length === 1 ? "" : "s"}. Uploaded files remain in storage if removed from the draft; automatic cleanup will be added later.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-primary">Floor plan</h2>
            <p className="mt-1 text-sm text-muted">Upload a clear JPG, PNG, or WebP plan. The interactive URL remains in the property details form.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-primary hover:border-primary/40">
            <Upload className="h-4 w-4" aria-hidden />
            Upload floor plan
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
              <img src={floorPlanUrl} alt="Floor plan preview" className="mx-auto max-h-[560px] w-full object-contain" />
              <button
                type="button"
                onClick={() => setFloorPlanUrl("")}
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

      <div className="sticky bottom-4 z-20 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving || uploading}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          {saving ? "Saving…" : "Save media changes"}
        </button>
      </div>
    </div>
  );
}
