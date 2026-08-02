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
import type {
  PropertyFact,
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
  tourEmbedUrl: string;
  tourExternalUrl: string;
  floorPlanImageUrl: string;
  floorPlanInteractiveProvider: PropertyTourProvider;
  floorPlanInteractiveExternalUrl: string;
  floorPlanInteractiveEmbedUrl: string;
  agencyName: string;
  agentName: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  published: boolean;
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
  const floorPlan = property?.floorPlans[0];

  return {
    slug: property?.slug ?? "",
    reference: property?.reference ?? "PS-",
    status: property?.status ?? "for-sale",
    titleEn: property?.title.en ?? "",
    titleEs: property?.title.es ?? "",
    summaryEn: property?.summary.en ?? "",
    summaryEs: property?.summary.es ?? "",
    descriptionEn: property?.description[0]?.en ?? "",
    descriptionEs: property?.description[0]?.es ?? "",
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
    tourEmbedUrl: property?.virtualTour?.embedUrl ?? "",
    tourExternalUrl: property?.virtualTour?.externalUrl ?? "",
    floorPlanImageUrl: floorPlan?.imageUrl ?? "",
    floorPlanInteractiveProvider:
      floorPlan?.interactiveProvider ?? "cubiCasa",
    floorPlanInteractiveExternalUrl:
      floorPlan?.interactiveExternalUrl ?? floorPlan?.interactiveUrl ?? "",
    floorPlanInteractiveEmbedUrl: floorPlan?.interactiveEmbedUrl ?? "",
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

  const hasTour = Boolean(
    state.tourEmbedUrl.trim() || state.tourExternalUrl.trim(),
  );
  const existingFloorPlans = existing?.floorPlans ?? [];
  const floorPlans: PropertyShowcase["floorPlans"] =
    existingFloorPlans.length > 0
      ? existingFloorPlans.map((plan, index) =>
          index === 0
            ? {
                ...plan,
                interactiveProvider: state.floorPlanInteractiveProvider,
                interactiveExternalUrl: optional(
                  state.floorPlanInteractiveExternalUrl,
                ),
                interactiveEmbedUrl: optional(state.floorPlanInteractiveEmbedUrl),
              }
            : plan,
        )
      : state.floorPlanImageUrl.trim()
        ? [
            {
              id: "main-floor",
              title: { en: "Main floor", es: "Planta principal" },
              imageUrl: state.floorPlanImageUrl.trim(),
              interactiveProvider: state.floorPlanInteractiveProvider,
              interactiveExternalUrl: optional(
                state.floorPlanInteractiveExternalUrl,
              ),
              interactiveEmbedUrl: optional(state.floorPlanInteractiveEmbedUrl),
              sortOrder: 1,
            },
          ]
        : [];

  return {
    slug: state.slug.trim(),
    reference: state.reference.trim(),
    status: state.status,
    title: { en: state.titleEn.trim(), es: optional(state.titleEs) },
    summary: { en: state.summaryEn.trim(), es: optional(state.summaryEs) },
    description: state.descriptionEn.trim()
      ? [
          {
            en: state.descriptionEn.trim(),
            es: optional(state.descriptionEs),
          },
        ]
      : [],
    priceLabel: { en: "Asking price", es: "Precio de venta" },
    price: state.price.trim(),
    coverImage,
    brochureUrl: existing?.brochureUrl,
    languages: ["en", "es"],
    facts: buildFacts(state),
    highlights: existing?.highlights ?? [],
    gallery,
    virtualTour: hasTour
      ? {
          provider: state.tourProvider,
          embedUrl: optional(state.tourEmbedUrl),
          externalUrl: optional(state.tourExternalUrl),
          posterImage: existing?.virtualTour?.posterImage ?? coverImage,
        }
      : undefined,
    floorPlans,
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
                    {record.property.price}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Updated {new Date(record.updatedAt).toLocaleString()}
                  </p>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                        Slug
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
                        Floor plan
                      </dt>
                      <dd className="mt-1 text-foreground">
                        {record.property.floorPlans.length > 0 ? "ready" : "not set"}
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
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    onError(null);

    const property = buildProperty(form, record?.property ?? null);
    const existingProperty = record?.property ?? null;
    const existingPrimaryFloorPlan = existingProperty?.floorPlans[0];
    const hasExistingInteractiveFloorPlan = Boolean(
      existingPrimaryFloorPlan?.interactiveExternalUrl?.trim() ||
        existingPrimaryFloorPlan?.interactiveEmbedUrl?.trim() ||
        existingPrimaryFloorPlan?.interactiveUrl?.trim(),
    );
    const removeVirtualTour =
      mode === "edit" &&
      Boolean(existingProperty?.virtualTour) &&
      !form.tourEmbedUrl.trim() &&
      !form.tourExternalUrl.trim();
    const removeInteractiveFloorPlan =
      mode === "edit" &&
      hasExistingInteractiveFloorPlan &&
      !form.floorPlanInteractiveExternalUrl.trim() &&
      !form.floorPlanInteractiveEmbedUrl.trim();
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
          removeInteractiveFloorPlan,
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
            <Field label="Slug">
              <input
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                value={form.slug}
                onChange={(event) =>
                  set("slug", event.target.value.toLowerCase())
                }
                className={inputClass}
                placeholder="villa-altea-hills"
              />
            </Field>
            <Field label="Reference">
              <input
                required
                value={form.reference}
                onChange={(event) => set("reference", event.target.value)}
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
                onChange={(event) => set("titleEn", event.target.value)}
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
            <Field label="Description — English">
              <textarea
                rows={5}
                value={form.descriptionEn}
                onChange={(event) => set("descriptionEn", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Description — Spanish">
              <textarea
                rows={5}
                value={form.descriptionEs}
                onChange={(event) => set("descriptionEs", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section title="Listing facts">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Price">
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
            <Field label="Built area">
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Tour provider">
              <select
                value={form.tourProvider}
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
            <Field label="Tour embed URL or iframe">
              <input
                value={form.tourEmbedUrl}
                onChange={(event) => set("tourEmbedUrl", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Tour share/original URL">
              <input
                value={form.tourExternalUrl}
                onChange={(event) => set("tourExternalUrl", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section title="Floor plans">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Floor plan image"
              hint="Protected. Upload or replace it in Manage photos & floor plans."
            >
              <input
                value={form.floorPlanImageUrl}
                readOnly
                aria-readonly="true"
                className={protectedMediaInputClass}
              />
            </Field>
            <Field label="Interactive plan provider">
              <select
                value={form.floorPlanInteractiveProvider}
                onChange={(event) =>
                  set(
                    "floorPlanInteractiveProvider",
                    event.target.value as PropertyTourProvider,
                  )
                }
                className={inputClass}
              >
                <option value="cubiCasa">CubiCasa</option>
                <option value="kuula">Kuula</option>
                <option value="matterport">Matterport</option>
                <option value="floorfy">Floorfy</option>
                <option value="nodalview">Nodalview</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            <Field label="Interactive plan share/original URL">
              <input
                value={form.floorPlanInteractiveExternalUrl}
                onChange={(event) =>
                  set("floorPlanInteractiveExternalUrl", event.target.value)
                }
                className={inputClass}
              />
            </Field>
            <Field label="Interactive plan embed iframe or URL">
              <textarea
                rows={3}
                value={form.floorPlanInteractiveEmbedUrl}
                onChange={(event) =>
                  set("floorPlanInteractiveEmbedUrl", event.target.value)
                }
                className={inputClass}
              />
            </Field>
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
