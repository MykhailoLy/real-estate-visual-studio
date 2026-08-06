"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  AlertTriangle,
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
import {
  getPrimaryLanguage,
  getPropertyLanguageOptions,
  PROPERTY_LANGUAGE_LABELS,
} from "@/features/property-showcase/localization";
import {
  getPropertySocialPreview,
  resolvedPropertySocialImages,
  updateGallerySocialPreview,
} from "@/features/property-showcase/social-preview";
import type {
  PropertyFloorPlan,
  PropertyGalleryImage,
  PropertyShowcase,
} from "@/features/property-showcase/types";
import { SITE_MEDIA_BUCKET } from "@/lib/site-media";
import { getSupabaseBrowser } from "@/lib/supabase";

const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_SOURCE_MB = MAX_SOURCE_BYTES / (1024 * 1024);
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_MIMES)[number];
type UploadKind =
  | "gallery"
  | "floor-plan"
  | "tour-poster"
  | "interactive-poster"
  | "agent-portrait"
  | "agency-logo";
type GeneratedSocialImageStatus =
  | "checking"
  | "available"
  | "fallback"
  | "failed";

const FLOOR_PLAN_PRESETS = [
  { en: "Ground floor", es: "Planta baja" },
  { en: "First floor", es: "Primera planta" },
  { en: "Second floor", es: "Segunda planta" },
  { en: "Basement", es: "Sótano" },
  { en: "Site plan", es: "Plano de parcela" },
  { en: "Garage", es: "Garaje" },
  { en: "Annex", es: "Anexo" },
  { en: "Other", es: "Otro" },
] as const;

const subscribeToPreviewHost = () => () => undefined;

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

async function cleanupUploadedPropertyFiles(
  slug: string,
  publicUrls: readonly string[],
  retainedUrls: readonly string[] = [],
): Promise<void> {
  if (publicUrls.length === 0) return;

  try {
    const response = await fetch("/api/admin/properties/upload-url", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        publicUrls,
        retainedUrls,
      }),
    });

    if (!response.ok) {
      console.warn(
        "property-showcase: failed upload cleanup returned an error",
        await readError(response),
      );
    }
  } catch (error) {
    console.warn("property-showcase: failed upload cleanup could not run", error);
  }
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
  const initialFloorPlans = [...record.property.floorPlans].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const [gallery, setGallery] = useState<PropertyGalleryImage[]>(initialGallery);
  const [coverImage, setCoverImage] = useState(record.property.coverImage);
  const [floorPlans, setFloorPlans] =
    useState<PropertyFloorPlan[]>(initialFloorPlans);
  const [tourPosterUrl, setTourPosterUrl] = useState(
    record.property.virtualTour?.posterImage ?? "",
  );
  const [interactivePosterUrl, setInteractivePosterUrl] = useState(
    record.property.interactiveFloorPlanTour?.posterImage ?? "",
  );
  const [agentPortraitUrl, setAgentPortraitUrl] = useState(
    record.property.agent.portraitUrl ?? "",
  );
  const [agencyLogoUrl, setAgencyLogoUrl] = useState(
    record.property.agent.logoUrl ?? "",
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedFloorPlanId, setDraggedFloorPlanId] = useState<string | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadDetail, setUploadDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSavings, setLastSavings] = useState<SavingsSummary | null>(null);
  const [generatedSocialImageStatus, setGeneratedSocialImageStatus] =
    useState<GeneratedSocialImageStatus>("checking");
  const isVercelPreview = useSyncExternalStore(
    subscribeToPreviewHost,
    () => window.location.hostname.endsWith(".vercel.app"),
    () => false,
  );

  const realGallery = gallery.filter((item) => !isDemoAsset(item.src));
  const primaryLanguage = getPrimaryLanguage(record.property);
  const floorPlanLanguages = getPropertyLanguageOptions(record.property);
  const socialPreviewProperty = useMemo(
    () => ({ ...record.property, coverImage, gallery }),
    [coverImage, gallery, record.property],
  );
  const socialPreview = useMemo(
    () => getPropertySocialPreview(socialPreviewProperty),
    [socialPreviewProperty],
  );
  const resolvedSocialImages = useMemo(
    () => resolvedPropertySocialImages(socialPreviewProperty),
    [socialPreviewProperty],
  );
  const generatedSocialImagePath = `/property/${encodeURIComponent(record.slug)}/opengraph-image`;

  useEffect(() => {
    if (!record.published) return;
    const controller = new AbortController();

    void fetch(generatedSocialImagePath, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok || !contentType.startsWith("image/png")) {
          setGeneratedSocialImageStatus("failed");
          return;
        }
        setGeneratedSocialImageStatus(
          response.headers.get("x-picchuspot-social-image-status") ===
            "fallback"
            ? "fallback"
            : "available",
        );
      })
      .catch((requestError: unknown) => {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }
        setGeneratedSocialImageStatus("failed");
      });

    return () => controller.abort();
  }, [generatedSocialImagePath, record.published, record.updatedAt]);

  function normalize(items: PropertyGalleryImage[]): PropertyGalleryImage[] {
    return items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
  }

  function normalizeFloorPlans(
    items: PropertyFloorPlan[],
  ): PropertyFloorPlan[] {
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

  function moveFloorPlan(planId: string, direction: -1 | 1) {
    setFloorPlans((current) => {
      const index = current.findIndex((item) => item.id === planId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return normalizeFloorPlans(next);
    });
  }

  function dropFloorPlanOn(targetId: string) {
    if (!draggedFloorPlanId || draggedFloorPlanId === targetId) return;
    setFloorPlans((current) => {
      const from = current.findIndex((item) => item.id === draggedFloorPlanId);
      const to = current.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return normalizeFloorPlans(next);
    });
    setDraggedFloorPlanId(null);
  }

  function updateFloorPlan(
    planId: string,
    patch: Partial<PropertyFloorPlan>,
  ) {
    setFloorPlans((current) =>
      current.map((plan) =>
        plan.id === planId
          ? {
              ...plan,
              ...patch,
            }
          : plan,
      ),
    );
  }

  function applyFloorPlanPreset(planId: string, preset: string) {
    const match = FLOOR_PLAN_PRESETS.find((item) => item.en === preset);
    if (!match) return;
    setFloorPlans((current) =>
      current.map((plan) =>
        plan.id === planId
          ? {
              ...plan,
              title: {
                ...plan.title,
                en: match.en,
                es: match.es,
                [primaryLanguage]:
                  primaryLanguage === "es" ? match.es : match.en,
              },
            }
          : plan,
      ),
    );
  }

  function toggleFeaturedForSharing(imageId: string) {
    setGallery((current) =>
      updateGallerySocialPreview(current, imageId, "toggle-featured"),
    );
  }

  function setPrimarySocialPreview(imageId: string) {
    setGallery((current) =>
      updateGallerySocialPreview(current, imageId, "set-primary"),
    );
  }

  function removeFloorPlan(planId: string) {
    if (
      !window.confirm(
        "Remove this floor plan from the property page? After you save, its property-owned Storage file will be deleted if nothing else uses it.",
      )
    ) {
      return;
    }

    setFloorPlans((current) =>
      normalizeFloorPlans(current.filter((plan) => plan.id !== planId)),
    );
  }

  function removeImage(imageId: string) {
    if (
      !window.confirm(
        "Remove this photo from the property page? After you save, its property-owned Storage file will be deleted if nothing else uses it.",
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

    const uploadedPublicUrls: string[] = [];

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
        uploadedPublicUrls.push(uploaded.publicUrl);
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
      await cleanupUploadedPropertyFiles(record.slug, uploadedPublicUrls, [
        ...gallery.map((image) => image.src),
        coverImage,
      ]);
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
    const uploadedPublicUrls: string[] = [];

    try {
      let next = [...floorPlans];
      let originalBytes = 0;
      let optimizedBytes = 0;

      for (let index = 0; index < files.length; index += 1) {
        const sourceFile = files[index];
        setUploadDetail(
          `Optimizing floor plan ${index + 1} of ${files.length}: ${sourceFile.name}`,
        );
        const optimized = await optimizePropertyImage(sourceFile, "floor-plan");
        originalBytes += optimized.originalBytes;
        optimizedBytes += optimized.optimizedBytes;
        setUploadDetail(
          `Uploading floor plan ${index + 1} of ${files.length}: ${formatImageBytes(optimized.originalBytes)} → ${formatImageBytes(optimized.optimizedBytes)} (${optimized.width} × ${optimized.height})`,
        );
        const uploaded = await uploadPropertyFile(
          record.slug,
          optimized.file,
          "floor-plan",
        );
        uploadedPublicUrls.push(uploaded.publicUrl);
        const label =
          displayName(sourceFile.name) || `Floor plan ${next.length + 1}`;
        next = [
          ...next,
          {
            id: `floor-plan-${crypto.randomUUID()}`,
            title: { en: label },
            imageUrl: uploaded.publicUrl,
            downloadUrl: uploaded.publicUrl,
            sortOrder: next.length + 1,
          },
        ];
      }

      const summary = {
        count: files.length,
        originalBytes,
        optimizedBytes,
      };
      setFloorPlans(normalizeFloorPlans(next));
      setLastSavings(summary);
      setNotice(
        `${files.length} floor plan${files.length === 1 ? "" : "s"} optimized and uploaded. ${formatImageBytes(originalBytes)} → ${formatImageBytes(optimizedBytes)} (${savingsPercent(summary)}% saved).`,
      );
    } catch (uploadError) {
      await cleanupUploadedPropertyFiles(
        record.slug,
        uploadedPublicUrls,
        floorPlans.flatMap((plan) => [plan.imageUrl, plan.downloadUrl ?? ""]),
      );
      setError(
        uploadError instanceof Error ? uploadError.message : "Floor plan upload failed.",
      );
    } finally {
      setUploading(false);
      setUploadDetail("");
    }
  }

  async function replaceFloorPlanImage(
    planId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const input = event.currentTarget;
    const sourceFile = input.files?.[0] ?? null;
    input.value = "";
    if (!sourceFile || uploading) return;
    if (
      !window.confirm(
        "Replace this floor-plan image? After you save, the detached property-owned Storage file will be deleted if nothing else uses it.",
      )
    ) {
      return;
    }

    const validation = validateSourceFile(sourceFile);
    if (validation) {
      setError(validation);
      return;
    }

    setUploading(true);
    setUploadDetail(`Optimizing replacement floor plan: ${sourceFile.name}`);
    setError(null);
    setNotice(null);
    setLastSavings(null);
    let uploadedPublicUrl = "";

    try {
      const optimized = await optimizePropertyImage(sourceFile, "floor-plan");
      setUploadDetail(
        `Uploading replacement floor plan: ${formatImageBytes(optimized.originalBytes)} → ${formatImageBytes(optimized.optimizedBytes)} (${optimized.width} × ${optimized.height})`,
      );
      const uploaded = await uploadPropertyFile(
        record.slug,
        optimized.file,
        "floor-plan",
      );
      uploadedPublicUrl = uploaded.publicUrl;
      setFloorPlans((current) =>
        current.map((plan) =>
          plan.id === planId
            ? {
                ...plan,
                imageUrl: uploaded.publicUrl,
                downloadUrl: uploaded.publicUrl,
              }
            : plan,
        ),
      );
      const summary = {
        count: 1,
        originalBytes: optimized.originalBytes,
        optimizedBytes: optimized.optimizedBytes,
      };
      setLastSavings(summary);
      setNotice(
        `Floor plan replacement optimized and uploaded. ${formatImageBytes(optimized.originalBytes)} → ${formatImageBytes(optimized.optimizedBytes)} (${optimized.savedPercent}% saved).`,
      );
    } catch (uploadError) {
      await cleanupUploadedPropertyFiles(
        record.slug,
        uploadedPublicUrl ? [uploadedPublicUrl] : [],
        floorPlans.flatMap((plan) => [plan.imageUrl, plan.downloadUrl ?? ""]),
      );
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Floor plan replacement failed.",
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
    let uploadedPublicUrl = "";
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
      uploadedPublicUrl = uploaded.publicUrl;
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
      await cleanupUploadedPropertyFiles(
        record.slug,
        uploadedPublicUrl ? [uploadedPublicUrl] : [],
        [tourPosterUrl],
      );
      setError(
        uploadError instanceof Error ? uploadError.message : "Tour poster upload failed.",
      );
    } finally {
      setUploading(false);
      setUploadDetail("");
    }
  }

  async function uploadSingleGalleryAsset(
    event: ChangeEvent<HTMLInputElement>,
    kind: Extract<
      UploadKind,
      "interactive-poster" | "agent-portrait" | "agency-logo"
    >,
    label: string,
    currentUrl: string,
    onUploaded: (url: string) => void,
  ) {
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
    setUploadDetail(`Optimizing ${label}: ${sourceFile.name}`);
    setError(null);
    setNotice(null);
    setLastSavings(null);
    let uploadedPublicUrl = "";
    try {
      const optimized = await optimizePropertyImage(sourceFile, "gallery");
      setUploadDetail(
        `Uploading ${label}: ${formatImageBytes(optimized.originalBytes)} -> ${formatImageBytes(optimized.optimizedBytes)} (${optimized.width} x ${optimized.height})`,
      );
      const uploaded = await uploadPropertyFile(record.slug, optimized.file, kind);
      uploadedPublicUrl = uploaded.publicUrl;
      onUploaded(uploaded.publicUrl);
      const summary = {
        count: 1,
        originalBytes: optimized.originalBytes,
        optimizedBytes: optimized.optimizedBytes,
      };
      setLastSavings(summary);
      setNotice(
        `${label} optimized and uploaded. ${formatImageBytes(optimized.originalBytes)} -> ${formatImageBytes(optimized.optimizedBytes)} (${optimized.savedPercent}% saved).`,
      );
    } catch (uploadError) {
      await cleanupUploadedPropertyFiles(
        record.slug,
        uploadedPublicUrl ? [uploadedPublicUrl] : [],
        [
          currentUrl,
          interactivePosterUrl,
          agentPortraitUrl,
          agencyLogoUrl,
        ],
      );
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : `${label} upload failed.`,
      );
    } finally {
      setUploading(false);
      setUploadDetail("");
    }
  }

  function removeSingleAsset(label: string, onRemoved: () => void) {
    if (
      !window.confirm(
        `Remove this ${label}? After you save, its property-owned Storage file will be deleted if nothing else uses it.`,
      )
    ) {
      return;
    }
    onRemoved();
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

    const cleanedFloorPlans = normalizeFloorPlans(
      floorPlans.filter((plan) => plan.imageUrl.trim()),
    );
    const removeFloorPlan =
      cleanedFloorPlans.length === 0 && record.property.floorPlans.length > 0;
    const removeInteractivePoster =
      Boolean(record.property.interactiveFloorPlanTour?.posterImage) &&
      !interactivePosterUrl.trim();

    const property: PropertyShowcase = {
      ...record.property,
      coverImage: finalCover,
      gallery: cleanedGallery,
      floorPlans: cleanedFloorPlans,
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
      interactiveFloorPlanTour: record.property.interactiveFloorPlanTour
        ? {
            ...record.property.interactiveFloorPlanTour,
            posterImage:
              !removeInteractivePoster &&
              interactivePosterUrl &&
              !isDemoAsset(interactivePosterUrl)
                ? interactivePosterUrl
                : record.property.interactiveFloorPlanTour.posterImage,
          }
        : undefined,
      agent: {
        ...record.property.agent,
        portraitUrl:
          agentPortraitUrl && !isDemoAsset(agentPortraitUrl)
            ? agentPortraitUrl
            : undefined,
        logoUrl:
          agencyLogoUrl && !isDemoAsset(agencyLogoUrl)
            ? agencyLogoUrl
            : undefined,
      },
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
          removeFloorPlan,
          removeInteractivePoster,
          replaceFloorPlans: true,
        }),
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setGallery(cleanedGallery);
      setCoverImage(finalCover);
      setFloorPlans(cleanedFloorPlans);
      setInteractivePosterUrl(
        removeInteractivePoster
          ? ""
          : property.interactiveFloorPlanTour?.posterImage ?? "",
      );
      setAgentPortraitUrl(property.agent.portraitUrl ?? "");
      setAgencyLogoUrl(property.agent.logoUrl ?? "");
      setNotice("Property media saved successfully.");
      router.refresh();
    } catch {
      setError("Network error while saving property media.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-24">
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
                        {image.featuredForSharing ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold text-sky-900">
                            <ImageIcon className="h-3 w-3" aria-hidden /> Share featured
                          </span>
                        ) : null}
                        {image.primarySocialPreview ? (
                          <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-white">
                            Social primary
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
                      <label className="flex items-center gap-2 text-xs font-bold text-primary">
                        <input
                          type="checkbox"
                          checked={image.featuredForSharing === true}
                          onChange={() => toggleFeaturedForSharing(image.id)}
                          disabled={demo}
                          className="h-4 w-4 accent-primary disabled:opacity-40"
                        />
                        Featured / best for sharing
                      </label>
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
                          onClick={() => setPrimarySocialPreview(image.id)}
                          disabled={demo}
                          aria-pressed={image.primarySocialPreview === true}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-primary disabled:opacity-40"
                        >
                          <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                          {image.primarySocialPreview
                            ? "Primary social image"
                            : "Set social primary"}
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
            {realGallery.length === 1 ? "" : "s"}. Removing a saved photo from the page deletes its old property-owned Storage object after the next successful save.
          </p>
          <p className="mt-2 text-xs text-muted">
            Mark the strongest images as featured for sharing. The social primary is used first; otherwise the first featured image or cover is used. Images marked Best for sharing are also used for the automatic hero slideshow.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <header className="border-b border-border p-5">
          <h2 className="text-lg font-bold text-primary">Social sharing preview</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            This compact preview uses the selected sharing images and the public-safe listing facts that will be rendered into the 1200 x 630 PNG.
          </p>
        </header>
        <div className="space-y-4 p-5">
          <div
            data-testid="social-card-admin-preview"
            className="mx-auto grid min-h-72 max-w-4xl overflow-hidden rounded-lg border border-border bg-surface md:aspect-[1200/630] md:min-h-0 md:grid-cols-[1.72fr_1fr]"
          >
            <div className="flex min-h-52 flex-col overflow-hidden bg-slate-200">
              {socialPreview.images[0] ? (
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={socialPreview.images[0].imageUrl}
                    alt={socialPreview.images[0].imageAlt}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="grid flex-1 place-items-center px-5 text-center text-sm text-muted">
                  No public social image available
                </div>
              )}
              {socialPreview.images.length > 1 ? (
                <div className="grid h-20 shrink-0 grid-cols-2 gap-0.5 border-t-2 border-white sm:h-28">
                  {socialPreview.images.slice(1, 3).map((image) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={image.imageUrl}
                      src={image.imageUrl}
                      alt={image.imageAlt}
                      className="h-full w-full object-cover"
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col bg-[#0B1F3A] p-5 text-white sm:p-6">
              {socialPreview.brandingMode === "picchuspot" ? (
                <div>
                  <p className="text-sm font-bold">
                    Picchu<span className="text-[#B88A44]">Spot</span>
                  </p>
                  <p className="mt-1 text-[10px] text-white/50">
                    Property Showcase by PicchuSpot
                  </p>
                </div>
              ) : socialPreview.brandingMode === "agency" ? (
                <div className="flex items-center gap-3">
                  {socialPreview.brandingLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={socialPreview.brandingLogoUrl}
                      alt=""
                      className="h-10 w-16 rounded bg-white/90 object-contain p-1"
                    />
                  ) : null}
                  <div>
                    <p className="text-sm font-bold">
                      {socialPreview.brandingName ?? "Agency"}
                    </p>
                    <p className="mt-1 text-[10px] text-white/50">
                      Powered by PicchuSpot
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-0.5 w-10 bg-[#B88A44]" />
              )}
              {socialPreview.location ? (
                <p className="mt-5 text-xs leading-5 text-white/65">
                  {socialPreview.location}
                </p>
              ) : null}
              <p className="mt-2 break-words text-xl font-bold leading-tight">
                {record.property.title[primaryLanguage] ?? record.property.title.en}
              </p>
              {socialPreview.price ? (
                <p className="mt-3 text-2xl font-bold text-[#d6b665]">
                  {socialPreview.price}
                </p>
              ) : null}
              <p className="mt-4 border-t border-white/15 pt-4 text-xs leading-5 text-white/70">
                {socialPreview.description}
              </p>
            </div>
          </div>

          {resolvedSocialImages.length === 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              No public social image is available. Choose a property-owned gallery image or a public PicchuSpot image.
            </div>
          ) : null}
          {!record.published ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              This property is unpublished, so social crawlers cannot access its public card yet.
            </div>
          ) : null}
          {isVercelPreview ? (
            <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Protected Vercel branch previews cannot be scraped by Telegram or WhatsApp. Test after merge on picchuspot.com, or temporarily disable Vercel Authentication for the preview deployment.
            </div>
          ) : null}
          {record.published ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <div
                className="inline-flex items-center gap-2 text-sm font-semibold text-muted"
                role="status"
              >
                {generatedSocialImageStatus === "checking" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : generatedSocialImageStatus === "available" ? (
                  <Check className="h-4 w-4 text-emerald-700" aria-hidden />
                ) : (
                  <AlertTriangle
                    className={`h-4 w-4 ${
                      generatedSocialImageStatus === "fallback"
                        ? "text-amber-700"
                        : "text-red-700"
                    }`}
                    aria-hidden
                  />
                )}
                {generatedSocialImageStatus === "checking"
                  ? "Checking generated image"
                  : generatedSocialImageStatus === "available"
                    ? "Generated image available"
                    : generatedSocialImageStatus === "fallback"
                      ? "Generated image fallback"
                      : "Generated image failed"}
              </div>
              <a
                href={generatedSocialImagePath}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                Open generated social PNG
              </a>
            </div>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-primary">Floor plans</h2>
            <p className="mt-1 text-sm text-muted">
              Upload one or several plans. The sharper WebP profile keeps room labels readable up to 4000 px.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-primary hover:border-primary/40">
            <Upload className="h-4 w-4" aria-hidden /> Add floor plans
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              multiple
              disabled={uploading || saving}
              onChange={uploadFloorPlan}
              className="sr-only"
            />
          </label>
        </header>
        <div className="p-5">
          {floorPlans.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {floorPlans.map((plan, index) => {
                const primary = index === 0;

                return (
                  <article
                    key={plan.id}
                    draggable
                    onDragStart={() => setDraggedFloorPlanId(plan.id)}
                    onDragEnd={() => setDraggedFloorPlanId(null)}
                    onDragOver={(event: DragEvent<HTMLElement>) =>
                      event.preventDefault()
                    }
                    onDrop={() => dropFloorPlanOn(plan.id)}
                    className={`overflow-hidden rounded-lg border bg-white transition ${
                      draggedFloorPlanId === plan.id
                        ? "border-primary opacity-55"
                        : "border-border"
                    }`}
                  >
                    <div className="relative aspect-[16/11] bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={plan.imageUrl}
                        alt=""
                        className="h-full w-full object-contain p-3"
                      />
                      <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
                          {index + 1}
                        </span>
                        {primary ? (
                          <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-bold text-primary-dark">
                            Primary
                          </span>
                        ) : null}
                      </div>
                      <div className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
                        <GripVertical className="h-4 w-4" aria-hidden />
                      </div>
                    </div>

                    <div className="space-y-3 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {floorPlanLanguages.map((language) => (
                          <label
                            key={language}
                            className="block min-w-0 text-xs font-bold text-foreground"
                          >
                            {PROPERTY_LANGUAGE_LABELS[language]} title
                            {language === primaryLanguage ? " (primary)" : ""}
                            <input
                              value={plan.title[language] ?? ""}
                              onChange={(event) =>
                                updateFloorPlan(plan.id, {
                                  title: {
                                    ...plan.title,
                                    [language]: event.target.value,
                                  },
                                })
                              }
                              className="mt-1.5 w-full min-w-0 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold outline-none focus:border-primary"
                            />
                          </label>
                        ))}
                        <label className="block text-xs font-bold text-foreground">
                          Floor/type preset
                          <select
                            value=""
                            onChange={(event) =>
                              applyFloorPlanPreset(plan.id, event.target.value)
                            }
                            className="mt-1.5 w-full rounded-lg border border-border px-2.5 py-2 text-xs font-semibold outline-none focus:border-primary"
                          >
                            <option value="">Choose a preset</option>
                            {FLOOR_PLAN_PRESETS.map((preset) => (
                              <option key={preset.en} value={preset.en}>
                                {preset.en} / {preset.es}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-primary">
                          <Upload className="h-3.5 w-3.5" aria-hidden />
                          Replace image
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                            disabled={uploading || saving}
                            onChange={(event) =>
                              replaceFloorPlanImage(plan.id, event)
                            }
                            className="sr-only"
                          />
                        </label>
                        <a
                          href={plan.downloadUrl ?? plan.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          Open file
                        </a>
                        <button
                          type="button"
                          onClick={() => moveFloorPlan(plan.id, -1)}
                          disabled={index === 0}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-primary disabled:opacity-30"
                          aria-label="Move floor plan earlier"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFloorPlan(plan.id, 1)}
                          disabled={index === floorPlans.length - 1}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-primary disabled:opacity-30"
                          aria-label="Move floor plan later"
                        >
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFloorPlan(plan.id)}
                          className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                          aria-label="Remove floor plan"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-sm text-muted">
              No floor plans uploaded.
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

      {record.property.interactiveFloorPlanTour ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-primary">Interactive floor-plan poster</h2>
              <p className="mt-1 text-sm text-muted">
                Used behind external-only interactive floor-plan links and before embeds activate.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-primary hover:border-primary/40">
              <Upload className="h-4 w-4" aria-hidden /> Upload poster
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                disabled={uploading || saving}
                onChange={(event) =>
                  uploadSingleGalleryAsset(
                    event,
                    "interactive-poster",
                    "Interactive floor-plan poster",
                    interactivePosterUrl,
                    setInteractivePosterUrl,
                  )
                }
                className="sr-only"
              />
            </label>
          </header>
          <div className="p-5">
            {interactivePosterUrl ? (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-2xl border border-border bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={interactivePosterUrl}
                    alt="Interactive floor-plan poster preview"
                    className="aspect-video w-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    removeSingleAsset("interactive floor-plan poster", () =>
                      setInteractivePosterUrl(""),
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Remove poster
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-sm text-muted">
                No interactive floor-plan poster uploaded.
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-primary">Realtor and agency media</h2>
            <p className="mt-1 text-sm text-muted">
              Upload the public contact-card portrait and agency logo into this property&apos;s media folder.
            </p>
          </div>
        </header>
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-primary">Realtor photo</h3>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-primary hover:border-primary/40">
                <Upload className="h-3.5 w-3.5" aria-hidden /> Upload
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  disabled={uploading || saving}
                  onChange={(event) =>
                    uploadSingleGalleryAsset(
                      event,
                      "agent-portrait",
                      "Realtor photo",
                      agentPortraitUrl,
                      setAgentPortraitUrl,
                    )
                  }
                  className="sr-only"
                />
              </label>
            </div>
            {agentPortraitUrl ? (
              <div className="mt-4 space-y-3">
                <div className="relative h-36 w-36 overflow-hidden rounded-full border border-border bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={agentPortraitUrl}
                    alt="Realtor portrait preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    removeSingleAsset("realtor photo", () => setAgentPortraitUrl(""))
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Remove photo
                </button>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-border bg-white px-4 py-5 text-sm text-muted">
                No realtor photo uploaded.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-primary">Agency logo</h3>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-primary hover:border-primary/40">
                <Upload className="h-3.5 w-3.5" aria-hidden /> Upload
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  disabled={uploading || saving}
                  onChange={(event) =>
                    uploadSingleGalleryAsset(
                      event,
                      "agency-logo",
                      "Agency logo",
                      agencyLogoUrl,
                      setAgencyLogoUrl,
                    )
                  }
                  className="sr-only"
                />
              </label>
            </div>
            {agencyLogoUrl ? (
              <div className="mt-4 space-y-3">
                <div className="relative h-28 w-48 overflow-hidden rounded-2xl border border-border bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={agencyLogoUrl}
                    alt="Agency logo preview"
                    className="h-full w-full object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    removeSingleAsset("agency logo", () => setAgencyLogoUrl(""))
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Remove logo
                </button>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-border bg-white px-4 py-5 text-sm text-muted">
                No agency logo uploaded.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 z-20 -mx-1 flex justify-end border-t border-border bg-white/95 p-3 shadow-[0_-10px_30px_rgba(15,36,64,0.08)] backdrop-blur">
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
