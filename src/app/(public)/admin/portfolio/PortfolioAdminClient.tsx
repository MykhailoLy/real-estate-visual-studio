"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  PORTFOLIO_BUCKET,
  PORTFOLIO_SERVICES,
  type PortfolioServiceSlug,
} from "@/lib/portfolio";
import { getSupabaseBrowser } from "@/lib/supabase";

// ============================================================
// PortfolioAdminClient
//
// One screen, three regions:
//   1. Top toolbar  — service filter + New item + Sign out
//   2. Editor panel — slides into view when creating or editing
//   3. Item table   — every existing portfolio_items row
//
// IMAGE UPLOAD FLOW (per item):
//   1. POST /api/admin/portfolio/upload-url     → JSON, ~few hundred bytes
//   2. supabase.storage.uploadToSignedUrl()     → bytes go browser → Supabase
//   3. POST /api/admin/portfolio (or PATCH)     → JSON metadata + paths
//
// Step 2 is the whole reason this file exists in its current
// shape: streaming multi-MB image bytes through a Vercel
// Function returns 413 FUNCTION_PAYLOAD_TOO_LARGE for the
// combined before+after pair. Routing them straight to Storage
// keeps the API request body as JSON metadata only.
//
// All mutations finish with router.refresh() so the server
// component re-fetches the row list. We do NOT mutate local
// state optimistically because revalidatePath() makes eventual
// consistency easier to reason about.
// ============================================================

export interface AdminItemView {
  id: string;
  service_slug: PortfolioServiceSlug;
  title: string;
  description: string | null;
  before_image_path: string;
  after_image_path: string;
  before_alt: string | null;
  after_alt: string | null;
  sort_order: number;
  featured_home: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
  /** Resolved public Supabase URL; null when env is unset. */
  before_url: string | null;
  after_url: string | null;
}

interface Props {
  items: AdminItemView[];
  adminConfigured: boolean;
  supabaseConfigured: boolean;
}

type EditorMode = "closed" | "create" | { kind: "edit"; item: AdminItemView };

const DEFAULT_SLUG: PortfolioServiceSlug = PORTFOLIO_SERVICES[0].slug;

// Limits and allowed types — match the server. Kept in this file
// so the client can reject invalid files BEFORE we ever ask for
// a signed URL, giving the admin a fast, clear error.
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_MB = MAX_BYTES / (1024 * 1024);
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = (typeof ALLOWED_MIMES)[number];

function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIMES as readonly string[]).includes(mime);
}

export default function PortfolioAdminClient({
  items,
  supabaseConfigured,
}: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<PortfolioServiceSlug | "all">("all");
  const [editor, setEditor] = useState<EditorMode>("closed");
  const [busy, setBusy] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [topNotice, setTopNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((it) => it.service_slug === filter);
  }, [items, filter]);

  function flashNotice(message: string) {
    setTopNotice(message);
    setTopError(null);
    // Clear after a few seconds so stale messages don't linger
    // forever above the table.
    window.setTimeout(() => setTopNotice(null), 4000);
  }

  function flashError(message: string) {
    setTopError(message);
    setTopNotice(null);
  }

  async function onDelete(item: AdminItemView) {
    if (busy) return;
    const ok = window.confirm(
      `Delete "${item.title}"? This removes the row and both image files. This cannot be undone.`
    );
    if (!ok) return;

    setBusy(true);
    setTopError(null);
    try {
      const res = await fetch(`/api/admin/portfolio/${item.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await safeJson(res);
        flashError(body?.error ?? "Could not delete portfolio item.");
        return;
      }
      flashNotice(`Deleted "${item.title}".`);
      // If the editor was open on this item, close it.
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
    <div>

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
              </code>{" "}
              and{" "}
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
              htmlFor="service-filter"
              className="text-xs font-semibold tracking-[0.15em] uppercase text-muted"
            >
              Service
            </label>
            <select
              id="service-filter"
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as PortfolioServiceSlug | "all")
              }
              className="px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All services</option>
              {PORTFOLIO_SERVICES.map((s) => (
                <option key={s.slug} value={s.slug}>
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

        {/* Top notice / error */}
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
          <PortfolioEditor
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

        {/* Items table */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted">
              No portfolio items yet. Click <strong>New item</strong> to add
              the first before / after pair.
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
  );
}

// ============================================================
// ItemRow — single portfolio_items row in the admin list
// ============================================================

interface ItemRowProps {
  item: AdminItemView;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function ItemRow({ item, busy, onEdit, onDelete }: ItemRowProps) {
  const meta = PORTFOLIO_SERVICES.find((s) => s.slug === item.service_slug);
  return (
    <li className="p-4 lg:p-5 flex flex-col lg:flex-row gap-4 lg:gap-6 lg:items-center">
      <div className="flex gap-2 flex-shrink-0">
        <Thumb url={item.before_url} label="Before" />
        <Thumb url={item.after_url} label="After" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3 className="text-base lg:text-lg font-bold text-primary tracking-tight truncate">
            {item.title}
          </h3>
          <Badge tone={item.published ? "good" : "neutral"}>
            {item.published ? "Published" : "Draft"}
          </Badge>
          {item.featured_home && (
            <Badge tone="accent">
              <Star className="w-3 h-3" aria-hidden />
              Home
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-1">
          <span className="font-medium text-foreground">
            {meta?.label ?? item.service_slug}
          </span>
          <span>Sort {item.sort_order}</span>
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
// PortfolioEditor — create / edit form
// ============================================================

interface EditorProps {
  mode: "create" | "edit";
  initial: AdminItemView | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}

interface SignedUploadInfo {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
}

/** What the editor reads out of the form before submitting. */
interface EditorValues {
  service_slug: PortfolioServiceSlug;
  title: string;
  description: string;
  before_alt: string;
  after_alt: string;
  sort_order: number;
  featured_home: boolean;
  published: boolean;
}

/** Stage of the multi-step submit, for nicer status copy. */
type Stage =
  | "idle"
  | "uploading-before"
  | "uploading-after"
  | "saving";

function PortfolioEditor({
  mode,
  initial,
  onClose,
  onSaved,
  onError,
}: EditorProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [localError, setLocalError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const isEdit = mode === "edit" && initial !== null;
  const submitting = stage !== "idle";

  /**
   * Local validation of a freshly-picked file. Mirrors the
   * server checks so the admin sees a clear error before any
   * network round-trip.
   */
  function checkFile(
    file: File,
    label: "Before image" | "After image"
  ): { ok: true } | { ok: false; message: string } {
    if (file.size === 0) {
      return { ok: false, message: `${label} appears to be empty.` };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, message: `File is too large. Max ${MAX_MB} MB.` };
    }
    if (!isAllowedMime(file.type)) {
      return {
        ok: false,
        message: "Unsupported file type. Use JPG, PNG, or WebP.",
      };
    }
    return { ok: true };
  }

  /**
   * Ask the server for a signed Supabase upload URL. The server
   * re-validates everything we just checked locally.
   */
  async function requestSignedUrl(
    serviceSlug: PortfolioServiceSlug,
    file: File,
    kind: "before" | "after"
  ): Promise<
    | { ok: true; data: SignedUploadInfo }
    | { ok: false; message: string }
  > {
    let res: Response;
    try {
      res = await fetch("/api/admin/portfolio/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          service_slug: serviceSlug,
          filename: file.name,
          content_type: file.type,
          file_size: file.size,
          kind,
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
    if (!payload.bucket || !payload.path || !payload.token || !payload.signedUrl) {
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

  /**
   * PUT the file straight to Supabase Storage using the signed
   * URL — bytes never touch our Vercel functions.
   */
  async function uploadOne(
    file: File,
    info: SignedUploadInfo
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    if (info.bucket !== PORTFOLIO_BUCKET) {
      return {
        ok: false,
        message: "Upload to Supabase failed. (Wrong bucket.)",
      };
    }
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.storage
        .from(PORTFOLIO_BUCKET)
        .uploadToSignedUrl(info.path, info.token, file, {
          contentType: file.type,
          upsert: false,
        });
      if (error) {
        console.warn("portfolio: uploadToSignedUrl failed", error);
        return { ok: false, message: "Upload to Supabase failed." };
      }
      return { ok: true };
    } catch (err) {
      console.warn("portfolio: uploadToSignedUrl threw", err);
      return { ok: false, message: "Upload to Supabase failed." };
    }
  }

  /**
   * Read the typed/checked values out of the form once. Booleans
   * come from the DOM elements directly because unchecked
   * checkboxes are absent from FormData entirely.
   */
  function readValues(form: HTMLFormElement): EditorValues {
    const fd = new FormData(form);
    const serviceSlug = String(fd.get("service_slug") ?? "") as PortfolioServiceSlug;
    const title = String(fd.get("title") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim();
    const before_alt = String(fd.get("before_alt") ?? "").trim();
    const after_alt = String(fd.get("after_alt") ?? "").trim();
    const sortRaw = String(fd.get("sort_order") ?? "0").trim();
    const sortNum = parseInt(sortRaw, 10);
    const featured_home =
      (form.elements.namedItem("featured_home") as HTMLInputElement | null)
        ?.checked ?? false;
    const published =
      (form.elements.namedItem("published") as HTMLInputElement | null)
        ?.checked ?? false;
    return {
      service_slug: serviceSlug,
      title,
      description,
      before_alt,
      after_alt,
      sort_order: Number.isFinite(sortNum) ? sortNum : 0,
      featured_home,
      published,
    };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setLocalError(null);

    const form = event.currentTarget;
    const values = readValues(form);

    if (!values.title) {
      const message = "Title is required.";
      setLocalError(message);
      onError(message);
      return;
    }

    // Pull the raw File handles. Empty file inputs return a File
    // with size 0; treat those as "no new file selected".
    const beforeInput = form.elements.namedItem(
      "before_image"
    ) as HTMLInputElement | null;
    const afterInput = form.elements.namedItem(
      "after_image"
    ) as HTMLInputElement | null;
    const beforeFile =
      beforeInput?.files && beforeInput.files[0] && beforeInput.files[0].size > 0
        ? beforeInput.files[0]
        : null;
    const afterFile =
      afterInput?.files && afterInput.files[0] && afterInput.files[0].size > 0
        ? afterInput.files[0]
        : null;

    // Create mode requires both files. Edit mode allows either to
    // stay the same.
    if (!isEdit) {
      if (!beforeFile) {
        const m = "Before image is required.";
        setLocalError(m);
        onError(m);
        return;
      }
      if (!afterFile) {
        const m = "After image is required.";
        setLocalError(m);
        onError(m);
        return;
      }
    }

    // Validate any picked files locally before any network calls.
    if (beforeFile) {
      const c = checkFile(beforeFile, "Before image");
      if (!c.ok) {
        setLocalError(c.message);
        onError(c.message);
        return;
      }
    }
    if (afterFile) {
      const c = checkFile(afterFile, "After image");
      if (!c.ok) {
        setLocalError(c.message);
        onError(c.message);
        return;
      }
    }

    // ----- 1+2. Upload changed files directly to Supabase -----
    let beforePath = isEdit && initial ? initial.before_image_path : "";
    let afterPath = isEdit && initial ? initial.after_image_path : "";

    try {
      if (beforeFile) {
        setStage("uploading-before");
        const signed = await requestSignedUrl(
          values.service_slug,
          beforeFile,
          "before"
        );
        if (!signed.ok) {
          setLocalError(signed.message);
          onError(signed.message);
          return;
        }
        const upload = await uploadOne(beforeFile, signed.data);
        if (!upload.ok) {
          setLocalError(upload.message);
          onError(upload.message);
          return;
        }
        beforePath = signed.data.path;
      }

      if (afterFile) {
        setStage("uploading-after");
        const signed = await requestSignedUrl(
          values.service_slug,
          afterFile,
          "after"
        );
        if (!signed.ok) {
          setLocalError(signed.message);
          onError(signed.message);
          return;
        }
        const upload = await uploadOne(afterFile, signed.data);
        if (!upload.ok) {
          setLocalError(upload.message);
          onError(upload.message);
          return;
        }
        afterPath = signed.data.path;
      }

      // ----- 3. Save the row metadata -----
      setStage("saving");

      if (!beforePath || !afterPath) {
        const m = "Could not save portfolio item.";
        setLocalError(m);
        onError(m);
        return;
      }

      const baseBody = {
        service_slug: values.service_slug,
        title: values.title,
        description: values.description || null,
        before_image_path: beforePath,
        after_image_path: afterPath,
        before_alt: values.before_alt || null,
        after_alt: values.after_alt || null,
        sort_order: values.sort_order,
        featured_home: values.featured_home,
        published: values.published,
      };

      const url = isEdit
        ? `/api/admin/portfolio/${initial!.id}`
        : "/api/admin/portfolio";

      let res: Response;
      try {
        res = await fetch(url, {
          method: isEdit ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(baseBody),
        });
      } catch {
        const m = "Could not save portfolio item.";
        setLocalError(m);
        onError(m);
        return;
      }

      if (!res.ok) {
        const body = await safeJson(res);
        const message = body?.error ?? "Could not save portfolio item.";
        setLocalError(message);
        onError(message);
        return;
      }

      onSaved(
        isEdit
          ? `Saved "${values.title || initial?.title || "item"}".`
          : `Created "${values.title || "item"}".`
      );
    } finally {
      setStage("idle");
    }
  }

  const submitLabel =
    stage === "uploading-before"
      ? "Uploading before image…"
      : stage === "uploading-after"
      ? "Uploading after image…"
      : stage === "saving"
      ? "Saving…"
      : isEdit
      ? "Save changes"
      : "Create item";

  return (
    <div className="bg-white border border-border rounded-2xl shadow-sm mb-6 lg:mb-8">
      <header className="flex items-center justify-between px-5 lg:px-6 py-4 border-b border-border">
        <h2 className="text-base lg:text-lg font-bold text-primary tracking-tight">
          {isEdit ? `Edit: ${initial?.title}` : "New portfolio item"}
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

      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="p-5 lg:p-6 space-y-5"
        noValidate
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
          <Field label="Service" htmlFor="service_slug" required>
            <select
              id="service_slug"
              name="service_slug"
              required
              defaultValue={initial?.service_slug ?? DEFAULT_SLUG}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {PORTFOLIO_SERVICES.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Title" htmlFor="title" required>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={140}
              defaultValue={initial?.title ?? ""}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Master bedroom — Scandinavian"
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

          <Field label="Visibility">
            <div className="flex flex-wrap gap-4 pt-1">
              <Toggle
                id="published"
                name="published"
                label="Published"
                defaultChecked={initial?.published ?? true}
              />
              <Toggle
                id="featured_home"
                name="featured_home"
                label="Featured on homepage"
                defaultChecked={initial?.featured_home ?? false}
              />
            </div>
          </Field>
        </div>

        <Field label="Description" htmlFor="description">
          <textarea
            id="description"
            name="description"
            rows={2}
            maxLength={500}
            defaultValue={initial?.description ?? ""}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Optional caption shown next to the example."
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
          <FilePair
            label="Before image"
            inputName="before_image"
            altName="before_alt"
            altDefault={initial?.before_alt ?? ""}
            existingUrl={initial?.before_url ?? null}
            isEdit={isEdit}
          />
          <FilePair
            label="After image"
            inputName="after_image"
            altName="after_alt"
            altDefault={initial?.after_alt ?? ""}
            existingUrl={initial?.after_url ?? null}
            isEdit={isEdit}
          />
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

interface FilePairProps {
  label: string;
  inputName: string;
  altName: string;
  altDefault: string;
  existingUrl: string | null;
  isEdit: boolean;
}

function FilePair({
  label,
  inputName,
  altName,
  altDefault,
  existingUrl,
  isEdit,
}: FilePairProps) {
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
            {!isEdit && <span className="text-red-500 ml-1">*</span>}
          </p>
          <input
            type="file"
            name={inputName}
            accept="image/jpeg,image/png,image/webp"
            required={!isEdit}
            className="block w-full text-sm text-foreground file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-white file:font-bold file:text-xs file:cursor-pointer hover:file:bg-primary-light"
          />
          <p className="mt-1 text-[11px] text-muted-light">
            JPG, PNG, or WebP. Max 10 MB.
            {isEdit && existingUrl && " Leave empty to keep the current image."}
          </p>
        </div>
      </div>
      <div>
        <label
          htmlFor={altName}
          className="block text-[11px] font-semibold tracking-[0.15em] uppercase text-muted mb-1"
        >
          Alt text
        </label>
        <input
          id={altName}
          name={altName}
          type="text"
          maxLength={200}
          defaultValue={altDefault}
          className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder={`${label} description for screen readers`}
        />
      </div>
    </div>
  );
}
