"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  PORTFOLIO_SERVICES,
  type PortfolioServiceSlug,
} from "@/lib/portfolio";

// ============================================================
// PortfolioAdminClient
//
// One screen, three regions:
//   1. Top toolbar  — service filter + New item + Sign out
//   2. Editor panel — slides into view when creating or editing
//   3. Item table   — every existing portfolio_items row
//
// All mutations go through /api/admin/portfolio[*]. After success
// we router.refresh() so the server component re-fetches the row
// list. We do NOT mutate local state optimistically because
// out-of-order responses + revalidatePath make eventual
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

  async function onLogout() {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // Even if the request fails the cookie is short-lived; we
      // still navigate away so the admin can re-auth.
    }
    router.replace("/admin/login");
    router.refresh();
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
        flashError(body?.error ?? "Could not delete item.");
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
    <section className="bg-surface min-h-[calc(100vh-4rem)] py-10 lg:py-14">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Header strip */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6 lg:mb-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-2">
              PicchuSpot Admin
            </p>
            <h1 className="text-3xl lg:text-4xl font-bold text-primary tracking-tight">
              Portfolio
            </h1>
            <p className="mt-1 text-sm text-muted">
              Upload before / after pairs and decide which ones the public
              site shows.
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 self-start sm:self-auto px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <LogOut className="w-4 h-4" aria-hidden />
            Sign out
          </button>
        </header>

        {!supabaseConfigured && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm leading-relaxed flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden />
            <div>
              Supabase is not fully configured on this deployment. Set{" "}
              <code className="font-mono text-[12px]">
                NEXT_PUBLIC_SUPABASE_URL
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
    </section>
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

function PortfolioEditor({
  mode,
  initial,
  onClose,
  onSaved,
  onError,
}: EditorProps) {
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const isEdit = mode === "edit" && initial !== null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setLocalError(null);

    const form = event.currentTarget;
    const data = new FormData(form);

    // For edit mode, drop empty file fields so we don't send a
    // 0-byte File object — the server treats that as "no file
    // selected", but it's clearer to omit it.
    if (isEdit) {
      const beforeFile = data.get("before_image");
      if (beforeFile instanceof File && beforeFile.size === 0) {
        data.delete("before_image");
      }
      const afterFile = data.get("after_image");
      if (afterFile instanceof File && afterFile.size === 0) {
        data.delete("after_image");
      }
    }

    // Booleans: native checkboxes only include their value when
    // checked. We always send "true"/"false" so the server can
    // distinguish "unchecked" from "not in form" (the latter
    // means leave-as-is in PATCH semantics).
    data.set(
      "published",
      (form.elements.namedItem("published") as HTMLInputElement | null)
        ?.checked
        ? "true"
        : "false"
    );
    data.set(
      "featured_home",
      (form.elements.namedItem("featured_home") as HTMLInputElement | null)
        ?.checked
        ? "true"
        : "false"
    );

    setSubmitting(true);
    try {
      const url = isEdit
        ? `/api/admin/portfolio/${initial!.id}`
        : "/api/admin/portfolio";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        body: data,
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await safeJson(res);
        const message = body?.error ?? "Save failed.";
        setLocalError(message);
        onError(message);
        return;
      }
      onSaved(
        isEdit
          ? `Saved "${data.get("title") ?? initial?.title ?? "item"}".`
          : `Created "${data.get("title") ?? "item"}".`
      );
    } catch {
      setLocalError("Network error during save.");
      onError("Network error during save.");
    } finally {
      setSubmitting(false);
    }
  }

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
        encType="multipart/form-data"
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
            {isEdit ? "Save changes" : "Create item"}
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
            accept="image/jpeg,image/jpg,image/png,image/webp"
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
