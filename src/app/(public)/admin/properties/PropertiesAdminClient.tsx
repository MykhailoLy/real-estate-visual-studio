"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Images,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  propertyCardActions,
} from "@/features/property-showcase/admin-routing";
import type { PropertyShowcaseAdminRecord } from "@/features/property-showcase/admin-types";
import {
  descriptionParagraphsFromText,
  descriptionTextForAdmin,
  formatPriceLabel,
  generatePropertyPageSlug,
} from "@/features/property-showcase/formatting";
import { normalizeTourPrimaryInput } from "@/features/property-showcase/provider-urls";
import type {
  PropertyFact,
  PropertyHighlight,
  PropertyShowcase,
  PropertyStatus,
  PropertyTourProvider,
} from "@/features/property-showcase/types";

interface Props {
  records: PropertyShowcaseAdminRecord[];
  supabaseConfigured: boolean;
  schemaReady: boolean;
}

type EditorMode =
  | "closed"
  | "create"
  | { kind: "edit"; record: PropertyShowcaseAdminRecord };

interface FormState {
  slug: string;
  reference: string;
  status: PropertyStatus;
  titleEn: string;
  titleEs: string;
  summaryEn: string;
  summaryEs: string;
  descriptionEn: string;
  descriptionEs: string;
  price: string;
  coverImage: string;
  bedrooms: string;
  bathrooms: string;
  builtArea: string;
  parking: string;
  addressEn: string;
  addressEs: string;
  privacyMode: "exact" | "approximate" | "hidden";
  tourProvider: PropertyTourProvider;
  tourInput: string;
  tourExternalUrl: string;
  highlights: HighlightFormState[];
  agencyName: string;
  agentName: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  published: boolean;
}

interface HighlightFormState {
  id: string;
  titleEn: string;
  titleEs: string;
  descriptionEn: string;
  descriptionEs: string;
}

const inputClass =
  "mt-1.5 w-full min-w-0 rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const protectedMediaInputClass =
  "mt-1.5 w-full min-w-0 cursor-not-allowed truncate rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-muted outline-none";

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function factValue(property: PropertyShowcase | null, key: PropertyFact["key"]) {
  return property?.facts.find((fact) => fact.key === key)?.value ?? "";
}

function initialState(record: PropertyShowcaseAdminRecord | null): FormState {
  const property = record?.property ?? null;

  return {
    slug: property?.slug ?? "",
    reference: property?.reference ?? "PS-",
    status: property?.status ?? "for-sale",
    titleEn: property?.title.en ?? "",
    titleEs: property?.title.es ?? "",
    summaryEn: property?.summary.en ?? "",
    summaryEs: property?.summary.es ?? "",
    descriptionEn: descriptionTextForAdmin(property?.description, "en"),
    descriptionEs: descriptionTextForAdmin(property?.description, "es"),
    price: property?.price ?? "",
    coverImage: property?.coverImage ?? "/property-demo/exterior.svg",
    bedrooms: factValue(property, "bedrooms"),
    bathrooms: factValue(property, "bathrooms"),
    builtArea: factValue(property, "built-area"),
    parking: factValue(property, "parking"),
    addressEn: property?.location.displayAddress.en ?? "",
    addressEs: property?.location.displayAddress.es ?? "",
    privacyMode: property?.location.privacyMode ?? "approximate",
    tourProvider: property?.virtualTour?.provider ?? "kuula",
    tourInput:
      property?.virtualTour?.externalUrl ?? property?.virtualTour?.embedUrl ?? "",
    tourExternalUrl: property?.virtualTour?.externalUrl ?? "",
    highlights:
      property?.highlights.map((highlight, index) => ({
        id: `highlight-${index}-${highlight.title.en}`,
        titleEn: highlight.title.en,
        titleEs: highlight.title.es ?? "",
        descriptionEn: highlight.description.en,
        descriptionEs: highlight.description.es ?? "",
      })) ?? [],
    agencyName: property?.agent.agencyName ?? "",
    agentName: property?.agent.agentName ?? "",
    phone: property?.agent.phone ?? "",
    whatsapp: property?.agent.whatsapp ?? "",
    email: property?.agent.email ?? "",
    website: property?.agent.website ?? "",
    published: record?.published ?? false,
  };
}

function buildFacts(state: FormState): PropertyFact[] {
  const facts: PropertyFact[] = [];

  if (state.bedrooms.trim()) {
    facts.push({
      key: "bedrooms",
      value: state.bedrooms.trim(),
      label: { en: "Bedrooms", es: "Dormitorios" },
    });
  }
  if (state.bathrooms.trim()) {
    facts.push({
      key: "bathrooms",
      value: state.bathrooms.trim(),
      label: { en: "Bathrooms", es: "Baños" },
    });
  }
  if (state.builtArea.trim()) {
    facts.push({
      key: "built-area",
      value: state.builtArea.trim(),
      label: { en: "Built area", es: "Superficie construida" },
    });
  }
  if (state.parking.trim()) {
    facts.push({
      key: "parking",
      value: state.parking.trim(),
      label: { en: "Parking", es: "Aparcamiento" },
    });
  }

  return facts;
}

function buildHighlights(items: readonly HighlightFormState[]): PropertyHighlight[] {
  return items
    .slice(0, 6)
    .map((item) => ({
      title: {
        en: item.titleEn.trim(),
        es: optional(item.titleEs),
      },
      description: {
        en: item.descriptionEn.trim(),
        es: optional(item.descriptionEs),
      },
    }))
    .filter(
      (highlight) =>
        highlight.title.en.length > 0 && highlight.description.en.length > 0,
    );
}

function buildProperty(
  state: FormState,
  existing: PropertyShowcase | null,
): PropertyShowcase {
  const coverImage = existing?.coverImage ?? state.coverImage.trim();
  let gallery = existing?.gallery ?? [];

  if (gallery.length === 0) {
    gallery = [
      {
        id: "cover",
        src: coverImage,
        alt: { en: state.titleEn.trim(), es: optional(state.titleEs) },
        label: { en: "Cover image", es: "Imagen principal" },
        sortOrder: 1,
      },
    ];
  }

  const tourInput = state.tourInput.trim();
  const hasTour = Boolean(tourInput || state.tourExternalUrl.trim());
  const normalizedTour =
    normalizeTourPrimaryInput(tourInput) ??
    normalizeTourPrimaryInput(tourInput, state.tourProvider);

  return {
    slug:
      state.slug.trim() ||
      generatePropertyPageSlug(state.titleEn, state.reference),
    reference: state.reference.trim(),
    status: state.status,
    title: { en: state.titleEn.trim(), es: optional(state.titleEs) },
    summary: { en: state.summaryEn.trim(), es: optional(state.summaryEs) },
    description: descriptionParagraphsFromText(
      state.descriptionEn,
      state.descriptionEs,
    ),
    priceLabel: { en: "Asking price", es: "Precio de venta" },
    price: state.price.trim(),
    coverImage,
    brochureUrl: existing?.brochureUrl,
    languages: ["en", "es"],
    facts: buildFacts(state),
    highlights: buildHighlights(state.highlights),
    gallery,
    virtualTour: hasTour
      ? {
          provider: normalizedTour?.provider ?? state.tourProvider,
          embedUrl: optional(tourInput),
          externalUrl: optional(state.tourExternalUrl),
          posterImage: existing?.virtualTour?.posterImage ?? coverImage,
        }
      : undefined,
    floorPlans: existing?.floorPlans ?? [],
    location: {
      displayAddress: {
        en: state.addressEn.trim(),
        es: optional(state.addressEs),
      },
      latitude: existing?.location.latitude,
      longitude: existing?.location.longitude,
      privacyMode: state.privacyMode,
      airportTravelTime: existing?.location.airportTravelTime,
    },
    agent: {
      agencyName: state.agencyName.trim(),
      agentName: optional(state.agentName),
      role: existing?.agent.role,
      logoUrl: existing?.agent.logoUrl,
      portraitUrl: existing?.agent.portraitUrl,
      phone: optional(state.phone),
      whatsapp: optional(state.whatsapp),
      email: optional(state.email),
      website: optional(state.website),
    },
    publishedAt: existing?.publishedAt,
  };
}

async function responseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "Request failed.";
  } catch {
    return "Request failed.";
  }
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-semibold text-foreground">
      {label}
      {children}
      {hint ? (
        <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-4 border-b border-border pb-2 text-xs font-bold uppercase tracking-[0.16em] text-secondary-dark">
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function PropertiesAdminClient({
  records,
  supabaseConfigured,
  schemaReady,
}: Props) {
  const router = useRouter();
  const [editor, setEditor] = useState<EditorMode>("closed");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function flash(message: string) {
    setNotice(message);
    setError(null);
    window.setTimeout(() => setNotice(null), 4000);
  }

  async function remove(record: PropertyShowcaseAdminRecord) {
    if (busy || !window.confirm(`Delete “${record.property.title.en}”?`)) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/properties/${record.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      setEditor("closed");
      flash(`Deleted “${record.property.title.en}”.`);
      router.refresh();
    } catch {
      setError("Network error while deleting the property.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!supabaseConfigured || !schemaReady ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            {!supabaseConfigured ? (
              "Supabase environment variables are not configured on this deployment."
            ) : (
              <>
                Review and manually run{" "}
                <code className="font-mono text-xs">
                  supabase/add-property-showcase-foundation.sql
                </code>{" "}
                in Supabase. No SQL has been executed automatically.
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-muted">
            {records.length} property showcase{records.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Listing details, publishing and external tour links.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => setEditor(editor === "create" ? "closed" : "create")}
            disabled={!schemaReady || busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New property
          </button>
          <Link
            href="/admin/properties/media"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-bold text-primary transition hover:border-primary/40"
          >
            <Images className="h-4 w-4" aria-hidden />
            Manage media
          </Link>
        </div>
      </div>

      {notice ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {editor !== "closed" ? (
        <PropertyEditor
          key={editor === "create" ? "create" : editor.record.id}
          mode={editor === "create" ? "create" : "edit"}
          record={editor === "create" ? null : editor.record}
          onClose={() => setEditor("closed")}
          onSaved={(message) => {
            setEditor("closed");
            flash(message);
            router.refresh();
          }}
          onError={setError}
        />
      ) : null}

      <div>
        {records.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white p-10 text-center text-sm text-muted shadow-sm">
            No property showcases yet.
          </div>
        ) : (
          <ul className="grid gap-4 xl:grid-cols-2">
            {records.map((record) => {
              const [viewAction, editAction, mediaAction, deleteAction] =
                propertyCardActions(record);

              return (
                <li
                key={record.id}
                className="min-w-0 rounded-2xl border border-border bg-white p-5 shadow-sm"
              >
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="min-w-0 break-words text-lg font-bold text-primary">
                      {record.property.title.en}
                    </h2>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${record.published ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                    >
                      {record.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    /property/{record.slug} · {record.property.reference} ·{" "}
                    {formatPriceLabel(record.property.price)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Updated {new Date(record.updatedAt).toLocaleString()}
                  </p>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                        Page URL
                      </dt>
                      <dd className="mt-1 break-all text-foreground">
                        /property/{record.slug}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                        Image count
                      </dt>
                      <dd className="mt-1 text-foreground">
                        {record.property.gallery.length}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                        Floor plans
                      </dt>
                      <dd className="mt-1 text-foreground">
                        {record.property.floorPlans.length > 0
                          ? `${record.property.floorPlans.length} ready`
                          : "not set"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                        360 tour
                      </dt>
                      <dd className="mt-1 text-foreground">
                        {record.property.virtualTour?.embedUrl ||
                        record.property.virtualTour?.externalUrl
                          ? record.property.virtualTour.provider
                          : "not set"}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Link
                    href={viewAction.href}
                    target="_blank"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-bold text-primary transition hover:border-primary/40"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />{" "}
                    {viewAction.label}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setEditor({ kind: "edit", record })}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-bold text-primary transition hover:border-primary/40 disabled:opacity-50"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />{" "}
                    {editAction.label}
                  </button>
                  <Link
                    href={mediaAction.href}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-bold text-primary transition hover:border-primary/40"
                  >
                    <Images className="h-4 w-4" aria-hidden />
                    {mediaAction.label}
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(record)}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3.5 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />{" "}
                    {deleteAction.label}
                  </button>
                </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function PropertyEditor({
  mode,
  record,
  onClose,
  onSaved,
  onError,
}: {
  mode: "create" | "edit";
  record: PropertyShowcaseAdminRecord | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string | null) => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialState(record));
  const [pageUrlTouched, setPageUrlTouched] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const normalizedTourPreview =
    normalizeTourPrimaryInput(form.tourInput) ??
    normalizeTourPrimaryInput(form.tourInput, form.tourProvider);
  const pageUrlPreview = `/property/${
    form.slug.trim() || generatePropertyPageSlug(form.titleEn, form.reference)
  }`;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setTitleEn(value: string) {
    setForm((current) => ({
      ...current,
      titleEn: value,
      slug:
        mode === "create" && !pageUrlTouched
          ? generatePropertyPageSlug(value, current.reference)
          : current.slug,
    }));
  }

  function setReference(value: string) {
    setForm((current) => ({
      ...current,
      reference: value,
      slug:
        mode === "create" && !pageUrlTouched && !current.titleEn.trim()
          ? generatePropertyPageSlug("", value)
          : current.slug,
    }));
  }

  function setPageUrl(value: string) {
    setPageUrlTouched(true);
    set("slug", generatePropertyPageSlug(value, value));
  }

  function addHighlight() {
    setForm((current) => {
      if (current.highlights.length >= 6) return current;
      return {
        ...current,
        highlights: [
          ...current.highlights,
          {
            id: `highlight-${crypto.randomUUID()}`,
            titleEn: "",
            titleEs: "",
            descriptionEn: "",
            descriptionEs: "",
          },
        ],
      };
    });
  }

  function updateHighlight<K extends keyof HighlightFormState>(
    id: string,
    key: K,
    value: HighlightFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      highlights: current.highlights.map((highlight) =>
        highlight.id === id ? { ...highlight, [key]: value } : highlight,
      ),
    }));
  }

  function removeHighlight(id: string) {
    setForm((current) => ({
      ...current,
      highlights: current.highlights.filter((highlight) => highlight.id !== id),
    }));
  }

  function moveHighlight(id: string, direction: -1 | 1) {
    setForm((current) => {
      const index = current.highlights.findIndex((highlight) => highlight.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.highlights.length) {
        return current;
      }
      const highlights = [...current.highlights];
      [highlights[index], highlights[target]] = [
        highlights[target],
        highlights[index],
      ];
      return { ...current, highlights };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    onError(null);

    const property = buildProperty(form, record?.property ?? null);
    const existingProperty = record?.property ?? null;
    const removeVirtualTour =
      mode === "edit" &&
      Boolean(existingProperty?.virtualTour) &&
      !form.tourInput.trim() &&
      !form.tourExternalUrl.trim();
    const endpoint =
      mode === "create"
        ? "/api/admin/properties"
        : `/api/admin/properties/${record?.id}`;

    try {
      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property,
          published: form.published,
          updateMode: mode === "create" ? "replace" : "details",
          removeVirtualTour,
        }),
      });
      if (!response.ok) {
        onError(await responseError(response));
        return;
      }
      onSaved(
        `${mode === "create" ? "Created" : "Updated"} “${property.title.en}”.`,
      );
    } catch {
      onError("Network error while saving the property.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-6 overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-lg font-bold text-primary">
            {mode === "create" ? "New property showcase" : "Edit property showcase"}
          </h2>
          <p className="mt-1 text-xs text-muted">
            Main listing data and external tour links. Photos and floor-plan files are managed separately.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-primary"
          aria-label="Close property editor"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="space-y-8 p-5 sm:p-6">
        <Section title="Identity and publishing">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Page URL"
              hint={
                mode === "edit"
                  ? "Locked because uploaded media and the public page address use this path."
                  : "Lowercase letters, numbers and hyphens only."
              }
            >
              <input
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                value={form.slug}
                readOnly={mode === "edit"}
                aria-readonly={mode === "edit"}
                onChange={(event) => {
                  if (mode === "create") {
                    setPageUrl(event.target.value);
                  }
                }}
                className={
                  mode === "edit" ? protectedMediaInputClass : inputClass
                }
                placeholder="villa-altea-hills"
              />
              <span className="mt-1 block break-all text-xs font-normal text-muted">
                picchuspot.com{pageUrlPreview}
              </span>
            </Field>
            <Field label="Reference">
              <input
                required
                value={form.reference}
                onChange={(event) => setReference(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(event) =>
                  set("status", event.target.value as PropertyStatus)
                }
                className={inputClass}
              >
                <option value="for-sale">For sale</option>
                <option value="reserved">Reserved</option>
                <option value="sold">Sold</option>
                <option value="off-market">Off market</option>
              </select>
            </Field>
            <label className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-primary md:self-end">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(event) => set("published", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Publish publicly
            </label>
          </div>
        </Section>

        <Section title="English and Spanish copy">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title — English">
              <input
                required
                value={form.titleEn}
                onChange={(event) => setTitleEn(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Title — Spanish">
              <input
                value={form.titleEs}
                onChange={(event) => set("titleEs", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Summary — English">
              <textarea
                required
                rows={3}
                value={form.summaryEn}
                onChange={(event) => set("summaryEn", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Summary — Spanish">
              <textarea
                rows={3}
                value={form.summaryEs}
                onChange={(event) => set("summaryEs", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field
              label="Description — English"
              hint="Separate paragraphs with a blank line."
            >
              <textarea
                rows={5}
                value={form.descriptionEn}
                onChange={(event) => set("descriptionEn", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field
              label="Description — Spanish"
              hint="Separate paragraphs with a blank line."
            >
              <textarea
                rows={5}
                value={form.descriptionEs}
                onChange={(event) => set("descriptionEs", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section title="Highlights">
          <div className="space-y-4">
            {form.highlights.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-sm text-muted">
                No highlights yet.
              </div>
            ) : (
              form.highlights.map((highlight, index) => (
                <article
                  key={highlight.id}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-primary">
                      Highlight {index + 1}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => moveHighlight(highlight.id, -1)}
                        disabled={index === 0}
                        className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-40"
                      >
                        Earlier
                      </button>
                      <button
                        type="button"
                        onClick={() => moveHighlight(highlight.id, 1)}
                        disabled={index === form.highlights.length - 1}
                        className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-40"
                      >
                        Later
                      </button>
                      <button
                        type="button"
                        onClick={() => removeHighlight(highlight.id)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Title — English">
                      <input
                        value={highlight.titleEn}
                        onChange={(event) =>
                          updateHighlight(highlight.id, "titleEn", event.target.value)
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Title — Spanish">
                      <input
                        value={highlight.titleEs}
                        onChange={(event) =>
                          updateHighlight(highlight.id, "titleEs", event.target.value)
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Description — English">
                      <textarea
                        rows={3}
                        value={highlight.descriptionEn}
                        onChange={(event) =>
                          updateHighlight(
                            highlight.id,
                            "descriptionEn",
                            event.target.value,
                          )
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Description — Spanish">
                      <textarea
                        rows={3}
                        value={highlight.descriptionEs}
                        onChange={(event) =>
                          updateHighlight(
                            highlight.id,
                            "descriptionEs",
                            event.target.value,
                          )
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </article>
              ))
            )}
            <button
              type="button"
              onClick={addHighlight}
              disabled={form.highlights.length >= 6}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-bold text-primary transition hover:border-primary/40 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add highlight
            </button>
          </div>
        </Section>

        <Section title="Listing facts">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Price"
              hint="Costa Blanca default is EUR, so 385560 displays as €385,560. For non-European listings, include the symbol, for example $385,560."
            >
              <input
                required
                value={form.price}
                onChange={(event) => set("price", event.target.value)}
                className={inputClass}
                placeholder="€695,000"
              />
            </Field>
            <Field label="Bedrooms">
              <input
                value={form.bedrooms}
                onChange={(event) => set("bedrooms", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Bathrooms">
              <input
                value={form.bathrooms}
                onChange={(event) => set("bathrooms", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field
              label="Built area"
              hint="Costa Blanca default is m². For non-European listings, include the unit, for example 1,900 sq ft or 9.19 acres."
            >
              <input
                value={form.builtArea}
                onChange={(event) => set("builtArea", event.target.value)}
                className={inputClass}
                placeholder="142 m²"
              />
            </Field>
            <Field label="Parking">
              <input
                value={form.parking}
                onChange={(event) => set("parking", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field
              label="Cover image"
              hint="Protected. Change it in Manage photos & floor plans."
            >
              <input
                value={form.coverImage}
                readOnly
                aria-readonly="true"
                className={protectedMediaInputClass}
              />
            </Field>
          </div>
        </Section>

        <Section title="Location">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Address — English">
              <input
                required
                value={form.addressEn}
                onChange={(event) => set("addressEn", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Address — Spanish">
              <input
                value={form.addressEs}
                onChange={(event) => set("addressEs", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Privacy">
              <select
                value={form.privacyMode}
                onChange={(event) =>
                  set(
                    "privacyMode",
                    event.target.value as FormState["privacyMode"],
                  )
                }
                className={inputClass}
              >
                <option value="exact">Exact</option>
                <option value="approximate">Approximate</option>
                <option value="hidden">Hidden</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section title="360 tour">
          <div className="space-y-4">
            <Field
              label="Tour link or embed code"
              hint="Paste a provider share link, MLS/unbranded link, embed URL or full iframe code."
            >
              <textarea
                rows={3}
                value={form.tourInput}
                onChange={(event) => set("tourInput", event.target.value)}
                className={inputClass}
              />
            </Field>

            <details className="rounded-xl border border-border bg-surface px-4 py-3">
              <summary className="cursor-pointer text-sm font-bold text-primary">
                Advanced settings
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Field label="Provider">
                  <select
                    value={normalizedTourPreview?.provider ?? form.tourProvider}
                    onChange={(event) =>
                      set(
                        "tourProvider",
                        event.target.value as PropertyTourProvider,
                      )
                    }
                    className={inputClass}
                  >
                    <option value="kuula">Kuula</option>
                    <option value="matterport">Matterport</option>
                    <option value="cubiCasa">CubiCasa</option>
                    <option value="floorfy">Floorfy</option>
                    <option value="nodalview">Nodalview</option>
                    <option value="custom">Custom</option>
                  </select>
                </Field>
                <Field label="Original/fallback URL">
                  <input
                    value={form.tourExternalUrl}
                    onChange={(event) => set("tourExternalUrl", event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Normalized embed URL preview">
                  <input
                    value={normalizedTourPreview?.embedUrl ?? ""}
                    readOnly
                    aria-readonly="true"
                    className={protectedMediaInputClass}
                  />
                </Field>
              </div>
            </details>
          </div>
        </Section>

        <Section title="Floor plans">
          <div className="rounded-xl border border-border bg-surface p-4 text-sm leading-6 text-muted">
            <p>
              {record?.property.floorPlans.length ?? 0} ordinary floor plan
              {(record?.property.floorPlans.length ?? 0) === 1 ? "" : "s"} saved.
              Upload, order, title and connect interactive plans in Manage media.
            </p>
            {record ? (
              <Link
                href={`/admin/properties/media?property=${encodeURIComponent(record.id)}`}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-bold text-primary transition hover:border-primary/40"
              >
                <Images className="h-4 w-4" aria-hidden />
                Manage floor plans
              </Link>
            ) : (
              <p className="mt-2 text-xs">
                Create the property first, then upload floor-plan files.
              </p>
            )}
          </div>
        </Section>

        <Section title="Agent and agency">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Agency">
              <input
                required
                value={form.agencyName}
                onChange={(event) => set("agencyName", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Agent name">
              <input
                value={form.agentName}
                onChange={(event) => set("agentName", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(event) => set("phone", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="WhatsApp">
              <input
                value={form.whatsapp}
                onChange={(event) => set("whatsapp", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) => set("email", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Website">
              <input
                value={form.website}
                onChange={(event) => set("website", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border bg-surface px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-bold text-primary disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-light disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {saving
            ? "Saving…"
            : mode === "create"
              ? "Create property"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
