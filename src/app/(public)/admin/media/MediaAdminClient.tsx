"use client";

import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  SITE_MEDIA_BUCKET,
  SITE_MEDIA_SECTION_META,
  SITE_MEDIA_TYPES,
  type SiteMediaSection,
  type SiteMediaType,
  type SiteMediaUploadKind,
} from "@/lib/site-media";
import { getSupabaseBrowser } from "@/lib/supabase";

// ============================================================
// MediaAdminClient
//
// Single-screen editor for site_media_items. Mirrors the layout
// of PortfolioAdminClient so muscle-memory transfers between
// the two admin surfaces:
//   1. Top toolbar  — section filter + New + Sign out
//   2. Editor panel — slides in for create/edit
//   3. Items list   — every row, grouped by section
//
// IMAGE UPLOAD FLOW (per file):
//   1. POST /api/admin/media/upload-url           (small JSON)
//   2. supabase.storage.uploadToSignedUrl(...)    (bytes go straight
//                                                  to Supabase)
//   3. POST/PATCH /api/admin/media[/:id]          (JSON metadata
//                                                  + paths)
//
// Step 2 is what keeps Vercel from returning 413
// FUNCTION_PAYLOAD_TOO_LARGE on multi-MB images. We do NOT push
// bytes through any Vercel function.
//
// All mutations finish with router.refresh() so the server
// component re-fetches the row list. We intentionally avoid
// optimistic local updates because revalidatePath() makes
// eventual consistency simpler to reason about.
// ============================================================

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_MB = MAX_BYTES / (1024 * 1024);
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_MIMES)[number];

function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIMES as readonly string[]).includes(mime);
}

// ------------------------------------------------------------
// View model — what the server component hands the client.
// ------------------------------------------------------------

export interface AdminMediaView {
  id: string;
  section: SiteMediaSection;
  media_type: SiteMediaType;
  title: string | null;
  description: string | null;
  service_slug: string | null;
  alt_text: string | null;
  before_image_path: string | null;
  after_image_path: string | null;
  image_path: string | null;
  poster_image_path: string | null;
  panorama_image_path: string | null;
  embed_url: string | null;
  sort_order: number;
  published: boolean;
  created_at: string;
  updated_at: string;
  // Resolved Supabase public URLs; null when env is unset OR
  // the underlying path is null.
  before_url: string | null;
  after_url: string | null;
  image_url: string | null;
  poster_url: string | null;
  panorama_url: string | null;
}

interface Props {
  items: AdminMediaView[];
  adminConfigured: boolean;
  supabaseConfigured: boolean;
}

type EditorMode = "closed" | "create" | { kind: "edit"; item: AdminMediaView };

const TYPE_LABELS: Record<SiteMediaType, string> = {
  "before-after": "Before / after",
  image: "Image",
  "panorama-360": "360° panorama",
  embed: "External embed",
  video: "Video",
};

// Which file slots a given media_type uses. Drives the form.
type SlotKey = "before" | "after" | "image" | "poster" | "panorama";

interface SlotConfig {
  kind: SiteMediaUploadKind;
  field:
    | "before_image_path"
    | "after_image_path"
    | "image_path"
    | "poster_image_path"
    | "panorama_image_path";
  label: string;
  required: boolean;
}

const SLOT_CONFIG: Record<SlotKey, SlotConfig> = {
  before: {
    kind: "before",
    field: "before_image_path",
    label: "Before image",
    required: true,
  },
  after: {
    kind: "after",
    field: "after_image_path",
    label: "After image",
    required: true,
  },
  image: {
    kind: "image",
    field: "image_path",
    label: "Image",
    required: true,
  },
  poster: {
    kind: "poster",
    field: "poster_image_path",
    label: "Poster image",
    required: false,
  },
  panorama: {
    kind: "panorama",
    field: "panorama_image_path",
    label: "Panorama image",
    required: true,
  },
};

/** Which slots a given media_type displays — and which of them
 *  are required vs optional. The required flag here overrides
 *  the SLOT_CONFIG default so e.g. a "video" item makes the
 *  poster slot required. */
function slotsForType(
  type: SiteMediaType
): Array<{ slot: SlotKey; required: boolean }> {
  switch (type) {
    case "before-after":
      return [
        { slot: "before", required: true },
        { slot: "after", required: true },
      ];
    case "image":
      return [{ slot: "image", required: true }];
    case "panorama-360":
      return [
        { slot: "panorama", required: true },
        { slot: "poster", required: false },
      ];
    case "embed":
      return [{ slot: "poster", required: false }];
    case "video":
      return [{ slot: "poster", required: true }];
  }
}

function showsEmbedField(type: SiteMediaType): boolean {
  return type === "embed" || type === "video" || type === "panorama-360";
}

function embedRequired(type: SiteMediaType): boolean {
  return type === "embed";
}

// ============================================================
// Top-level component
// ============================================================

export default function MediaAdminClient({
  items,
  supabaseConfigured,
}: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<SiteMediaSection | "all">("all");
  const [editor, setEditor] = useState<EditorMode>("closed");
  const [busy, setBusy] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [topNotice, setTopNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((it) => it.section === filter);
  }, [items, filter]);

  function flashNotice(message: string) {
    setTopNotice(message);
    setTopError(null);
    window.setTimeout(() => setTopNotice(null), 4000);
  }
  function flashError(message: string) {
    setTopError(message);
    setTopNotice(null);
  }

  async function onLogout() {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // Cookie is short-lived; navigate regardless.
    }
    router.replace("/admin/login");
    router.refresh();
  }

  async function onDelete(item: AdminMediaView) {
    if (busy) return;
    const label = item.title || `${item.section} item`;
    const ok = window.confirm(
      `Delete "${label}"? This removes the row and any associated image files. This cannot be undone.`
    );
    if (!ok) return;

    setBusy(true);
    setTopError(null);
    try {
      const res = await fetch(`/api/admin/media/${item.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await safeJson(res);
        flashError(body?.error ?? "Could not delete site media item.");
        return;
      }
      flashNotice(`Deleted "${label}".`);
      if (typeof editor === "object" && editor.item.id === item.id) {
        setEditor("closed");
      }
      router.refresh();
    } catch {
      flashError("Network error during delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-surface min-h-[calc(100vh-4rem)] py-10 lg:py-14">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Header strip */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6 lg:mb-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-2">
              PicchuSpot Admin
            </p>
            <h1 className="text-3xl lg:text-4xl font-bold text-primary tracking-tight">
              Site Media
            </h1>
            <p className="mt-1 text-sm text-muted">
              Manage fixed website imagery — homepage slider, About collage,
              360° tours, and future service heroes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/portfolio"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden />
              Portfolio
            </Link>
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
            >
              Orders
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <LogOut className="w-4 h-4" aria-hidden />
              Sign out
            </button>
          </div>
        </header>

        {!supabaseConfigured && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm leading-relaxed flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden />
            <div>
              Supabase is not fully configured on this deployment. Set{" "}
              <code className="font-mono text-[12px]">
                NEXT_PUBLIC_SUPABASE_URL
              </code>
              ,{" "}
              <code className="font-mono text-[12px]">
                NEXT_PUBLIC_SUPABASE_ANON_KEY
              </code>
              , and{" "}
              <code className="font-mono text-[12px]">
                SUPABASE_SERVICE_ROLE_KEY
              </code>
              , then redeploy. Until then the list is empty and uploads will
              fail with a clear error.
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-3">
            <label
              htmlFor="section-filter"
              className="text-xs font-semibold tracking-[0.15em] uppercase text-muted"
            >
              Section
            </label>
            <select
              id="section-filter"
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as SiteMediaSection | "all")
              }
              className="px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All sections</option>
              {SITE_MEDIA_SECTION_META.map((s) => (
                <option key={s.section} value={s.section}>
                  {s.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">
              {filtered.length} item
              {filtered.length === 1 ? "" : "s"}
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              setEditor((cur) => (cur === "create" ? "closed" : "create"))
            }
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-light transition-colors disabled:opacity-60"
          >
            <Plus className="w-4 h-4" aria-hidden />
            New item
          </button>
        </div>

        {topNotice && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm px-3 py-2">
            {topNotice}
          </div>
        )}
        {topError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
            {topError}
          </div>
        )}

        {/* Editor panel */}
        {editor !== "closed" && (
          <MediaEditor
            mode={editor === "create" ? "create" : "edit"}
            initial={editor === "create" ? null : editor.item}
            onClose={() => setEditor("closed")}
            onSaved={(message) => {
              setEditor("closed");
              flashNotice(message);
              router.refresh();
            }}
            onError={flashError}
          />
        )}

        {/* Items list */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted">
              No site media yet. Click <strong>New item</strong> to add one.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  busy={busy}
                  onEdit={() => setEditor({ kind: "edit", item })}
                  onDelete={() => onDelete(item)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// ItemRow
// ============================================================

function ItemRow({
  item,
  busy,
  onEdit,
  onDelete,
}: {
  item: AdminMediaView;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const sectionMeta = SITE_MEDIA_SECTION_META.find(
    (s) => s.section === item.section
  );
  // Pick a representative thumbnail per type so the list is
  // scannable even when titles are missing.
  const thumbs: Array<{ url: string | null; label: string }> = [];
  if (item.media_type === "before-after") {
    thumbs.push({ url: item.before_url, label: "Before" });
    thumbs.push({ url: item.after_url, label: "After" });
  } else if (item.media_type === "image") {
    thumbs.push({ url: item.image_url, label: "Image" });
  } else if (item.media_type === "panorama-360") {
    thumbs.push({ url: item.panorama_url, label: "360°" });
    if (item.poster_url) thumbs.push({ url: item.poster_url, label: "Poster" });
  } else if (item.media_type === "embed") {
    thumbs.push({ url: item.poster_url, label: "Embed" });
  } else if (item.media_type === "video") {
    thumbs.push({ url: item.poster_url, label: "Video" });
  }

  return (
    <li className="p-4 lg:p-5 flex flex-col lg:flex-row gap-4 lg:gap-6 lg:items-center">
      <div className="flex gap-2 flex-shrink-0">
        {thumbs.length === 0 ? (
          <Thumb url={null} label="—" />
        ) : (
          thumbs.map((t, i) => <Thumb key={i} url={t.url} label={t.label} />)
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3 className="text-base lg:text-lg font-bold text-primary tracking-tight truncate">
            {item.title || <span className="text-muted">(untitled)</span>}
          </h3>
          <Badge tone={item.published ? "good" : "neutral"}>
            {item.published ? "Published" : "Draft"}
          </Badge>
          <Badge tone="accent">{TYPE_LABELS[item.media_type]}</Badge>
        </div>
        <div className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-1">
          <span className="font-medium text-foreground">
            {sectionMeta?.label ?? item.section}
          </span>
          <span>Sort {item.sort_order}</span>
          {item.service_slug && <span>Service: {item.service_slug}</span>}
          {item.embed_url && (
            <span className="inline-flex items-center gap-1">
              <LinkIcon className="w-3 h-3" aria-hidden />
              embed
            </span>
          )}
          <span className="hidden sm:inline truncate">
            Updated {formatDate(item.updated_at)}
          </span>
        </div>
        {item.description && (
          <p className="mt-2 text-sm text-muted leading-relaxed line-clamp-2">
            {item.description}
          </p>
        )}
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-60"
        >
          <Pencil className="w-4 h-4" aria-hidden />
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors disabled:opacity-60"
        >
          <Trash2 className="w-4 h-4" aria-hidden />
          Delete
        </button>
      </div>
    </li>
  );
}

function Thumb({ url, label }: { url: string | null; label: string }) {
  return (
    <div
      className="relative w-20 h-20 lg:w-24 lg:h-24 rounded-lg overflow-hidden bg-stone-100 border border-border flex items-center justify-center"
      title={label}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <ImageIcon className="w-5 h-5 text-muted-light" aria-hidden />
      )}
      <span className="absolute bottom-1 left-1 text-[9px] font-bold tracking-[0.15em] uppercase text-white bg-black/55 px-1.5 py-0.5 rounded">
        {label}
      </span>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "good" | "accent" | "neutral";
}) {
  const styles =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
      : tone === "accent"
      ? "bg-secondary/15 text-secondary-dark border border-secondary/40"
      : "bg-stone-100 text-muted border border-border";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-[0.12em] uppercase ${styles}`}
    >
      {children}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

async function safeJson(res: Response): Promise<{ error?: string } | null> {
  try {
    return (await res.json()) as { error?: string };
  } catch {
    return null;
  }
}

// ============================================================
// MediaEditor — create / edit form
// ============================================================

interface SignedUploadInfo {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
}

interface EditorProps {
  mode: "create" | "edit";
  initial: AdminMediaView | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}

type Stage = "idle" | "uploading" | "saving";

function MediaEditor({
  mode,
  initial,
  onClose,
  onSaved,
  onError,
}: EditorProps) {
  const isEdit = mode === "edit" && initial !== null;

  // Reactive controls — section + media_type drive which inputs
  // render, so we manage them in state rather than reading FormData.
  const [section, setSection] = useState<SiteMediaSection>(
    initial?.section ?? SITE_MEDIA_SECTION_META[0].section
  );
  const [mediaType, setMediaType] = useState<SiteMediaType>(
    initial ? initial.media_type : (SITE_MEDIA_SECTION_META[0].defaultMediaType)
  );

  // Per-slot file state. `null` means "no new file picked".
  const [files, setFiles] = useState<Record<SlotKey, File | null>>({
    before: null,
    after: null,
    image: null,
    poster: null,
    panorama: null,
  });

  const [stage, setStage] = useState<Stage>("idle");
  const [stageDetail, setStageDetail] = useState<string>("");
  const [localError, setLocalError] = useState<string | null>(null);
  const submitting = stage !== "idle";

  // When the section changes during a fresh create, snap
  // media_type to that section's preferred default. Editing an
  // existing item keeps whatever the row already had.
  // We handle this in the section onChange instead of a useEffect
  // to avoid calling setState synchronously within an effect body.

  function checkFile(file: File, label: string): string | null {
    if (file.size === 0) return `${label} appears to be empty.`;
    if (file.size > MAX_BYTES) return `File is too large. Max ${MAX_MB} MB.`;
    if (!isAllowedMime(file.type))
      return "Unsupported file type. Use JPG, PNG, or WebP.";
    return null;
  }

  function onPickFile(slot: SlotKey, e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f) {
      const err = checkFile(f, SLOT_CONFIG[slot].label);
      if (err) {
        // Clear the picker and surface the error so the admin
        // sees a clear reason without a network round trip.
        e.target.value = "";
        setFiles((prev) => ({ ...prev, [slot]: null }));
        setLocalError(err);
        onError(err);
        return;
      }
    }
    setLocalError(null);
    setFiles((prev) => ({ ...prev, [slot]: f }));
  }

  async function requestSignedUrl(
    file: File,
    kind: SiteMediaUploadKind
  ): Promise<
    | { ok: true; data: SignedUploadInfo }
    | { ok: false; message: string }
  > {
    let res: Response;
    try {
      res = await fetch("/api/admin/media/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          section,
          kind,
          filename: file.name,
          content_type: file.type,
          file_size: file.size,
        }),
      });
    } catch {
      return { ok: false, message: "Could not create signed upload URL." };
    }
    if (!res.ok) {
      const body = await safeJson(res);
      return {
        ok: false,
        message: body?.error ?? "Could not create signed upload URL.",
      };
    }
    let payload: Partial<SignedUploadInfo> = {};
    try {
      payload = (await res.json()) as Partial<SignedUploadInfo>;
    } catch {
      // fall through
    }
    if (
      !payload.bucket ||
      !payload.path ||
      !payload.token ||
      !payload.signedUrl
    ) {
      return { ok: false, message: "Could not create signed upload URL." };
    }
    return {
      ok: true,
      data: {
        bucket: payload.bucket,
        path: payload.path,
        token: payload.token,
        signedUrl: payload.signedUrl,
      },
    };
  }

  async function uploadOne(
    file: File,
    info: SignedUploadInfo
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    if (info.bucket !== SITE_MEDIA_BUCKET) {
      return {
        ok: false,
        message: "Upload to Supabase failed. (Wrong bucket.)",
      };
    }
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.storage
        .from(SITE_MEDIA_BUCKET)
        .uploadToSignedUrl(info.path, info.token, file, {
          contentType: file.type,
          upsert: false,
        });
      if (error) {
        console.warn("site-media: uploadToSignedUrl failed", error);
        return { ok: false, message: "Upload to Supabase failed." };
      }
      return { ok: true };
    } catch (err) {
      console.warn("site-media: uploadToSignedUrl threw", err);
      return { ok: false, message: "Upload to Supabase failed." };
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setLocalError(null);

    const form = event.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get("title") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim();
    const altText = String(fd.get("alt_text") ?? "").trim();
    const serviceSlug = String(fd.get("service_slug") ?? "").trim();
    const embedUrl = String(fd.get("embed_url") ?? "").trim();
    const sortOrderRaw = String(fd.get("sort_order") ?? "0").trim();
    const sortOrder = (() => {
      const n = parseInt(sortOrderRaw, 10);
      return Number.isFinite(n) ? n : 0;
    })();
    const published =
      (form.elements.namedItem("published") as HTMLInputElement | null)
        ?.checked ?? true;

    const slots = slotsForType(mediaType);
    const usedFields = new Set(slots.map((s) => SLOT_CONFIG[s.slot].field));

    // Embed URL gate. Required-vs-optional depends on media_type.
    if (showsEmbedField(mediaType) && embedRequired(mediaType) && !embedUrl) {
      const m = "Embed URL is required for an embed item.";
      setLocalError(m);
      onError(m);
      return;
    }
    if (embedUrl) {
      try {
        // Constructor throws on invalid URLs; we don't care about
        // the parsed value, only that it parsed.
        new URL(embedUrl);
      } catch {
        const m = "Embed URL must be a valid URL.";
        setLocalError(m);
        onError(m);
        return;
      }
    }

    // For required slots, the editor needs a path: either the
    // existing one (edit mode) or a freshly-picked file.
    for (const { slot, required } of slots) {
      if (!required) continue;
      const cfg = SLOT_CONFIG[slot];
      const hasExisting = isEdit && initial && initial[cfg.field];
      const hasNew = files[slot] !== null;
      if (!hasExisting && !hasNew) {
        const m = `${cfg.label} is required.`;
        setLocalError(m);
        onError(m);
        return;
      }
    }

    // ----- Upload any newly-picked files -----
    type Field = SlotConfig["field"];
    const finalPaths: Record<Field, string | null> = {
      before_image_path: isEdit && initial ? initial.before_image_path : null,
      after_image_path: isEdit && initial ? initial.after_image_path : null,
      image_path: isEdit && initial ? initial.image_path : null,
      poster_image_path: isEdit && initial ? initial.poster_image_path : null,
      panorama_image_path:
        isEdit && initial ? initial.panorama_image_path : null,
    };

    // Slots NOT used by the chosen media_type are cleared on
    // save so we don't carry around a stale before-image path on
    // an item that's now of type "image".
    for (const cfg of Object.values(SLOT_CONFIG)) {
      if (!usedFields.has(cfg.field)) {
        finalPaths[cfg.field] = null;
      }
    }

    try {
      for (const { slot } of slots) {
        const file = files[slot];
        if (!file) continue;
        const cfg = SLOT_CONFIG[slot];

        setStage("uploading");
        setStageDetail(cfg.label);

        const signed = await requestSignedUrl(file, cfg.kind);
        if (!signed.ok) {
          setLocalError(signed.message);
          onError(signed.message);
          return;
        }
        const upload = await uploadOne(file, signed.data);
        if (!upload.ok) {
          setLocalError(upload.message);
          onError(upload.message);
          return;
        }
        finalPaths[cfg.field] = signed.data.path;
      }

      // ----- Save the row metadata -----
      setStage("saving");
      setStageDetail("");

      const baseBody: Record<string, unknown> = {
        section,
        media_type: mediaType,
        title: title || null,
        description: description || null,
        service_slug: serviceSlug || null,
        alt_text: altText || null,
        before_image_path: finalPaths.before_image_path,
        after_image_path: finalPaths.after_image_path,
        image_path: finalPaths.image_path,
        poster_image_path: finalPaths.poster_image_path,
        panorama_image_path: finalPaths.panorama_image_path,
        embed_url: showsEmbedField(mediaType) ? embedUrl || null : null,
        sort_order: sortOrder,
        published,
      };

      const url = isEdit
        ? `/api/admin/media/${initial!.id}`
        : "/api/admin/media";

      let res: Response;
      try {
        res = await fetch(url, {
          method: isEdit ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(baseBody),
        });
      } catch {
        const m = "Could not save site media item.";
        setLocalError(m);
        onError(m);
        return;
      }

      if (!res.ok) {
        const body = await safeJson(res);
        const message = body?.error ?? "Could not save site media item.";
        setLocalError(message);
        onError(message);
        return;
      }

      onSaved(
        isEdit
          ? `Saved "${title || initial?.title || "item"}".`
          : `Created "${title || "item"}".`
      );
    } finally {
      setStage("idle");
      setStageDetail("");
    }
  }

  const slots = slotsForType(mediaType);

  const submitLabel =
    stage === "uploading"
      ? `Uploading${stageDetail ? ` ${stageDetail.toLowerCase()}` : ""}…`
      : stage === "saving"
      ? "Saving…"
      : isEdit
      ? "Save changes"
      : "Create item";

  return (
    <div className="bg-white border border-border rounded-2xl shadow-sm mb-6 lg:mb-8">
      <header className="flex items-center justify-between px-5 lg:px-6 py-4 border-b border-border">
        <h2 className="text-base lg:text-lg font-bold text-primary tracking-tight">
          {isEdit
            ? `Edit: ${initial?.title || "(untitled)"}`
            : "New site media item"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-foreground p-1 -mr-1"
          aria-label="Close editor"
        >
          <X className="w-5 h-5" aria-hidden />
        </button>
      </header>

      <form onSubmit={onSubmit} className="p-5 lg:p-6 space-y-5" noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
          <Field label="Section" htmlFor="section" required>
            <select
              id="section"
              name="section"
              required
              value={section}
              onChange={(e) => {
                const next = e.target.value as SiteMediaSection;
                setSection(next);
                // When creating, snap media_type to the new section's default.
                // (Editing keeps whatever the row already has.)
                if (!isEdit) {
                  const meta = SITE_MEDIA_SECTION_META.find(
                    (s) => s.section === next
                  );
                  if (meta) setMediaType(meta.defaultMediaType);
                }
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {SITE_MEDIA_SECTION_META.map((s) => (
                <option key={s.section} value={s.section}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-light">
              {
                SITE_MEDIA_SECTION_META.find((s) => s.section === section)
                  ?.description
              }
            </p>
          </Field>

          <Field label="Media type" htmlFor="media_type" required>
            <select
              id="media_type"
              name="media_type"
              required
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as SiteMediaType)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {SITE_MEDIA_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Title" htmlFor="title">
            <input
              id="title"
              name="title"
              type="text"
              maxLength={200}
              defaultValue={initial?.title ?? ""}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Optional headline"
            />
          </Field>

          <Field label="Sort order" htmlFor="sort_order">
            <input
              id="sort_order"
              name="sort_order"
              type="number"
              defaultValue={initial?.sort_order ?? 0}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </Field>

          <Field label="Service slug (optional)" htmlFor="service_slug">
            <input
              id="service_slug"
              name="service_slug"
              type="text"
              maxLength={100}
              defaultValue={initial?.service_slug ?? ""}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. virtual-staging"
            />
            <p className="mt-1 text-[11px] text-muted-light">
              If this matches a portfolio service slug, the matching pricing
              page will revalidate on save.
            </p>
          </Field>

          <Field label="Visibility">
            <div className="flex flex-wrap gap-4 pt-1">
              <Toggle
                id="published"
                name="published"
                label="Published"
                defaultChecked={initial?.published ?? true}
              />
            </div>
          </Field>
        </div>

        <Field label="Description" htmlFor="description">
          <textarea
            id="description"
            name="description"
            rows={2}
            maxLength={2000}
            defaultValue={initial?.description ?? ""}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Optional caption shown next to the media."
          />
        </Field>

        <Field label="Alt text" htmlFor="alt_text">
          <input
            id="alt_text"
            name="alt_text"
            type="text"
            maxLength={300}
            defaultValue={initial?.alt_text ?? ""}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Description for screen readers"
          />
        </Field>

        {/* Embed URL — visible only for media types that use it. */}
        {showsEmbedField(mediaType) && (
          <Field
            label={`Embed URL${embedRequired(mediaType) ? "" : " (optional)"}`}
            htmlFor="embed_url"
            required={embedRequired(mediaType)}
          >
            <input
              id="embed_url"
              name="embed_url"
              type="url"
              maxLength={2000}
              defaultValue={initial?.embed_url ?? ""}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="https://kuula.co/share/... or a video URL"
            />
          </Field>
        )}

        {/* File slots — render only those needed by media_type. */}
        <div
          className={`grid grid-cols-1 ${
            slots.length > 1 ? "md:grid-cols-2" : ""
          } gap-4 lg:gap-5`}
        >
          {slots.map(({ slot, required }) => {
            const cfg = SLOT_CONFIG[slot];
            const existingUrl = (() => {
              if (!isEdit || !initial) return null;
              switch (slot) {
                case "before":
                  return initial.before_url;
                case "after":
                  return initial.after_url;
                case "image":
                  return initial.image_url;
                case "poster":
                  return initial.poster_url;
                case "panorama":
                  return initial.panorama_url;
              }
            })();
            return (
              <FileSlot
                key={slot}
                label={cfg.label}
                required={required}
                inputName={`file_${slot}`}
                existingUrl={existingUrl}
                isEdit={isEdit}
                onChange={(e) => onPickFile(slot, e)}
              />
            );
          })}
        </div>

        {localError && (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
            {localError}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-light transition-colors disabled:opacity-60"
          >
            {submitting && (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            )}
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ label, htmlFor, required, children }: FieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold tracking-[0.15em] uppercase text-muted mb-1.5"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  id,
  name,
  label,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer"
    >
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
      />
      {label}
    </label>
  );
}

interface FileSlotProps {
  label: string;
  required: boolean;
  inputName: string;
  existingUrl: string | null | undefined;
  isEdit: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

function FileSlot({
  label,
  required,
  inputName,
  existingUrl,
  isEdit,
  onChange,
}: FileSlotProps) {
  return (
    <div className="rounded-lg border border-border bg-surface/50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-stone-100 border border-border flex items-center justify-center flex-shrink-0">
          {existingUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={existingUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImageIcon className="w-5 h-5 text-muted-light" aria-hidden />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-muted mb-1.5">
            {label}
            {required && !isEdit && <span className="text-red-500 ml-1">*</span>}
          </p>
          <input
            type="file"
            name={inputName}
            accept="image/jpeg,image/png,image/webp"
            onChange={onChange}
            className="block w-full text-sm text-foreground file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-white file:font-bold file:text-xs file:cursor-pointer hover:file:bg-primary-light"
          />
          <p className="mt-1 text-[11px] text-muted-light">
            JPG, PNG, or WebP. Max {MAX_MB} MB.
            {isEdit && existingUrl && " Leave empty to keep the current image."}
          </p>
        </div>
      </div>
    </div>
  );
}
