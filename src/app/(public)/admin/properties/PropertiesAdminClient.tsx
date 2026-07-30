"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { PropertyShowcaseAdminRecord } from "@/features/property-showcase/admin-types";
import type {
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
  priceLabelEn: string;
  priceLabelEs: string;
  price: string;
  coverImage: string;
  brochureUrl: string;
  bedrooms: string;
  bathrooms: string;
  builtArea: string;
  parking: string;
  addressEn: string;
  addressEs: string;
  privacyMode: "exact" | "approximate" | "hidden";
  airportEn: string;
  airportEs: string;
  tourProvider: PropertyTourProvider;
  tourEmbedUrl: string;
  tourExternalUrl: string;
  tourPosterImage: string;
  floorPlanImageUrl: string;
  floorPlanDownloadUrl: string;
  floorPlanInteractiveUrl: string;
  agencyName: string;
  agentName: string;
  roleEn: string;
  roleEs: string;
  logoUrl: string;
  portraitUrl: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  published: boolean;
}

const inputClass =
  "mt-1.5 w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function factValue(property: PropertyShowcase | null, key: string): string {
  return property?.facts.find((fact) => fact.key === key)?.value ?? "";
}

function createInitialState(
  record: PropertyShowcaseAdminRecord | null,
): FormState {
  const property = record?.property ?? null;
  const firstDescription = property?.description[0];
  const firstPlan = property?.floorPlans[0];

  return {
    slug: property?.slug ?? "",
    reference: property?.reference ?? "PS-",
    status: property?.status ?? "for-sale",
    titleEn: property?.title.en ?? "",
    titleEs: property?.title.es ?? "",
    summaryEn: property?.summary.en ?? "",
    summaryEs: property?.summary.es ?? "",
    descriptionEn: firstDescription?.en ?? "",
    descriptionEs: firstDescription?.es ?? "",
    priceLabelEn: property?.priceLabel.en ?? "Asking price",
    priceLabelEs: property?.priceLabel.es ?? "Precio de venta",
    price: property?.price ?? "",
    coverImage: property?.coverImage ?? "/property-demo/exterior.svg",
    brochureUrl: property?.brochureUrl ?? "",
    bedrooms: factValue(property, "bedrooms"),
    bathrooms: factValue(property, "bathrooms"),
    builtArea: factValue(property, "built-area"),
    parking: factValue(property, "parking"),
    addressEn: property?.location.displayAddress.en ?? "",
    addressEs: property?.location.displayAddress.es ?? "",
    privacyMode: property?.location.privacyMode ?? "approximate",
    airportEn: property?.location.airportTravelTime?.en ?? "",
    airportEs: property?.location.airportTravelTime?.es ?? "",
    tourProvider: property?.virtualTour?.provider ?? "kuula",
    tourEmbedUrl: property?.virtualTour?.embedUrl ?? "",
    tourExternalUrl: property?.virtualTour?.externalUrl ?? "",
    tourPosterImage: property?.virtualTour?.posterImage ?? "",
    floorPlanImageUrl: firstPlan?.imageUrl ?? "",
    floorPlanDownloadUrl: firstPlan?.downloadUrl ?? "",
    floorPlanInteractiveUrl: firstPlan?.interactiveUrl ?? "",
    agencyName: property?.agent.agencyName ?? "",
    agentName: property?.agent.agentName ?? "",
    roleEn: property?.agent.role?.en ?? "",
    roleEs: property?.agent.role?.es ?? "",
    logoUrl: property?.agent.logoUrl ?? "",
    portraitUrl: property?.agent.portraitUrl ?? "",
    phone: property?.agent.phone ?? "",
    whatsapp: property?.agent.whatsapp ?? "",
    email: property?.agent.email ?? "",
    website: property?.agent.website ?? "",
    published: record?.published ?? false,
  };
}

function buildProperty(
  state: FormState,
  existing: PropertyShowcase | null,
): PropertyShowcase {
  const facts: PropertyShowcase["facts"] = [
    state.bedrooms.trim()
      ? {
          key: "bedrooms",
          value: state.bedrooms.trim(),
          label: { en: "Bedrooms", es: "Dormitorios" },
        }
      : null,
    state.bathrooms.trim()
      ? {
          key: "bathrooms",
          value: state.bathrooms.trim(),
          label: { en: "Bathrooms", es: "Baños" },
        }
      : null,
    state.builtArea.trim()
      ? {
          key: "built-area",
          value: state.builtArea.trim(),
          label: { en: "Built area", es: "Superficie construida" },
        }
      : null,
    state.parking.trim()
      ? {
          key: "parking",
          value: state.parking.trim(),
          label: { en: "Parking", es: "Aparcamiento" },
        }
      : null,
  ].filter((fact): fact is NonNullable<typeof fact> => fact !== null);

  let gallery = existing?.gallery ?? [];
  if (gallery.length === 0) {
    gallery = [
      {
        id: "cover",
        src: state.coverImage.trim(),
        alt: {
          en: state.titleEn.trim(),
          es: optional(state.titleEs),
        },
        label: { en: "Cover image", es: "Imagen principal" },
        sortOrder: 1,
      },
    ];
  } else if (
    existing &&
    gallery[0]?.src === existing.coverImage &&
    existing.coverImage !== state.coverImage.trim()
  ) {
    gallery = [
      { ...gallery[0], src: state.coverImage.trim() },
      ...gallery.slice(1),
    ];
  }

  const floorPlans: PropertyShowcase["floorPlans"] = state.floorPlanImageUrl.trim()
    ? [
        {
          id: existing?.floorPlans[0]?.id ?? "main-floor",
          title: existing?.floorPlans[0]?.title ?? {
            en: "Main floor",
            es: "Planta principal",
          },
          imageUrl: state.floorPlanImageUrl.trim(),
          downloadUrl: optional(state.floorPlanDownloadUrl),
          interactiveUrl: optional(state.floorPlanInteractiveUrl),
          sortOrder: existing?.floorPlans[0]?.sortOrder ?? 1,
        },
        ...(existing?.floorPlans.slice(1) ?? []),
      ]
    : [];

  const hasTour = Boolean(
    state.tourEmbedUrl.trim() ||
      state.tourExternalUrl.trim() ||
      state.tourPosterImage.trim(),
  );

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
    priceLabel: {
      en: state.priceLabelEn.trim(),
      es: optional(state.priceLabelEs),
    },
    price: state.price.trim(),
    coverImage: state.coverImage.trim(),
    brochureUrl: optional(state.brochureUrl),
    languages: ["en", "es"],
    facts,
    highlights: existing?.highlights ?? [],
    gallery,
    virtualTour: hasTour
      ? {
          provider: state.tourProvider,
          embedUrl: optional(state.tourEmbedUrl),
          externalUrl: optional(state.tourExternalUrl),
          posterImage: optional(state.tourPosterImage),
        }
      : undefined,
    floorPlans,
    location: {
      displayAddress: {
        en: state.addressEn.trim(),
        es: optional(state.addressEs),
      },
      privacyMode: state.privacyMode,
      airportTravelTime:
        state.airportEn.trim() || state.airportEs.trim()
          ? {
              en: state.airportEn.trim(),
              es: optional(state.airportEs),
            }
          : undefined,
    },
    agent: {
      agencyName: state.agencyName.trim(),
      agentName: optional(state.agentName),
      role:
        state.roleEn.trim() || state.roleEs.trim()
          ? { en: state.roleEn.trim(), es: optional(state.roleEs) }
          : undefined,
      logoUrl: optional(state.logoUrl),
      portraitUrl: optional(state.portraitUrl),
      phone: optional(state.phone),
      whatsapp: optional(state.whatsapp),
      email: optional(state.email),
      website: optional(state.website),
    },
    publishedAt: existing?.publishedAt,
  };
}

async function safeJson(response: Response): Promise<{ error?: string } | null> {
  try {
    return (await response.json()) as { error?: string };
  } catch {
    return null;
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
      {hint ? <span className="mt-1 block text-xs font-normal text-muted">{hint}</span> : null}
    </label>
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

  function showNotice(message: string) {
    setNotice(message);
    setError(null);
    window.setTimeout(() => setNotice(null), 4000);
  }

  async function deleteRecord(record: PropertyShowcaseAdminRecord) {
    if (busy) return;
    if (!window.confirm(`Delete “${record.property.title.en}”? This cannot be undone.`)) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/properties/${record.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) {
        const body = await safeJson(response);
        setError(body?.error ?? "Could not delete property showcase.");
        return;
      }
      if (typeof editor === "object" && editor.record.id === record.id) {
        setEditor("closed");
      }
      showNotice(`Deleted “${record.property.title.en}”.`);
      router.refresh();
    } catch {
      setError("Network error while deleting the property.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!supabaseConfigured ? (
        <SetupNotice>
          Supabase environment variables are not configured on this deployment.
        </SetupNotice>
      ) : !schemaReady ? (
        <SetupNotice>
          The property table is not installed yet. Review and manually run{" "}
          <code className="font-mono text-xs">supabase/add-property-showcase-foundation.sql</code>{" "}
          in the Supabase SQL Editor. No SQL has been executed automatically.
        </SetupNotice>
      ) : null}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            {records.length} property showcase{records.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Metadata first; direct media upload and gallery sorting come next.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditor(editor === "create" ? "closed" : "create")}
          disabled={!schemaReady || busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New property
        </button>
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
          mode={editor === "create" ? "create" : "edit"}
          record={editor === "create" ? null : editor.record}
          onClose={() => setEditor("closed")}
          onSaved={(message) => {
            setEditor("closed");
            showNotice(message);
            router.refresh();
          }}
          onError={setError}
        />
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        {records.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">
            No property showcases yet. Create the first record after the migration is installed.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {records.map((record) => (
              <li
                key={record.id}
                className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-bold text-primary">
                      {record.property.title.en}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                        record.published
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {record.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    /property/{record.slug} · {record.property.reference} · {record.property.price}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Updated {new Date(record.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {record.published ? (
                    <Link
                      href={`/property/${record.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-bold text-primary transition hover:border-primary/40"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden />
                      Open
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setEditor({ kind: "edit", record })}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-bold text-primary transition hover:border-primary/40 disabled:opacity-50"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRecord(record)}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3.5 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SetupNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
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
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState<FormState>(() => createInitialState(record));
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    onError("");
    try {
      const property = buildProperty(form, record?.property ?? null);
      const endpoint =
        mode === "create" ? "/api/admin/properties" : `/api/admin/properties/${record?.id}`;
      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property, published: form.published }),
      });

      if (!response.ok) {
        const body = await safeJson(response);
        onError(body?.error ?? "Could not save property showcase.");
        return;
      }

      onSaved(
        mode === "create"
          ? `Created “${property.title.en}”.`
          : `Updated “${property.title.en}”.`,
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
            Save metadata now. Real image uploads and drag-to-sort gallery management follow in the next layer.
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
        <FormSection title="Identity and publication">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Slug">
              <input
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                value={form.slug}
                onChange={(event) => set("slug", event.target.value.toLowerCase())}
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
                placeholder="PS-002"
              />
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(event) => set("status", event.target.value as PropertyStatus)}
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
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Publish publicly
            </label>
          </div>
        </FormSection>

        <FormSection title="English and Spanish copy">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title — English">
              <input required value={form.titleEn} onChange={(event) => set("titleEn", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Title — Spanish">
              <input value={form.titleEs} onChange={(event) => set("titleEs", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Summary — English">
              <textarea required rows={3} value={form.summaryEn} onChange={(event) => set("summaryEn", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Summary — Spanish">
              <textarea rows={3} value={form.summaryEs} onChange={(event) => set("summaryEs", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Description — English">
              <textarea rows={5} value={form.descriptionEn} onChange={(event) => set("descriptionEn", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Description — Spanish">
              <textarea rows={5} value={form.descriptionEs} onChange={(event) => set("descriptionEs", event.target.value)} className={inputClass} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Price and core facts">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Price">
              <input required value={form.price} onChange={(event) => set("price", event.target.value)} className={inputClass} placeholder="€695,000" />
            </Field>
            <Field label="Price label — English">
              <input required value={form.priceLabelEn} onChange={(event) => set("priceLabelEn", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Price label — Spanish">
              <input value={form.priceLabelEs} onChange={(event) => set("priceLabelEs", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Bedrooms">
              <input value={form.bedrooms} onChange={(event) => set("bedrooms", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Bathrooms">
              <input value={form.bathrooms} onChange={(event) => set("bathrooms", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Built area">
              <input value={form.builtArea} onChange={(event) => set("builtArea", event.target.value)} className={inputClass} placeholder="142 m²" />
            </Field>
            <Field label="Parking">
              <input value={form.parking} onChange={(event) => set("parking", event.target.value)} className={inputClass} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Main media">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Cover image URL" hint="Local path or public URL. Direct upload is the next step.">
              <input required value={form.coverImage} onChange={(event) => set("coverImage", event.target.value)} className={inputClass} />
            </Field>
            <Field label="PDF brochure URL">
              <input value={form.brochureUrl} onChange={(event) => set("brochureUrl", event.target.value)} className={inputClass} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="360 tour">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Provider">
              <select value={form.tourProvider} onChange={(event) => set("tourProvider", event.target.value as PropertyTourProvider)} className={inputClass}>
                <option value="kuula">Kuula</option>
                <option value="matterport">Matterport</option>
                <option value="cubiCasa">CubiCasa</option>
                <option value="floorfy">Floorfy</option>
                <option value="nodalview">Nodalview</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            <Field label="Embed URL">
              <input value={form.tourEmbedUrl} onChange={(event) => set("tourEmbedUrl", event.target.value)} className={inputClass} />
            </Field>
            <Field label="External URL">
              <input value={form.tourExternalUrl} onChange={(event) => set("tourExternalUrl", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Poster image URL">
              <input value={form.tourPosterImage} onChange={(event) => set("tourPosterImage", event.target.value)} className={inputClass} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Floor plan">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Plan image URL">
              <input value={form.floorPlanImageUrl} onChange={(event) => set("floorPlanImageUrl", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Download URL">
              <input value={form.floorPlanDownloadUrl} onChange={(event) => set("floorPlanDownloadUrl", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Interactive plan URL">
              <input value={form.floorPlanInteractiveUrl} onChange={(event) => set("floorPlanInteractiveUrl", event.target.value)} className={inputClass} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Location">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Display address — English">
              <input required value={form.addressEn} onChange={(event) => set("addressEn", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Display address — Spanish">
              <input value={form.addressEs} onChange={(event) => set("addressEs", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Privacy">
              <select value={form.privacyMode} onChange={(event) => set("privacyMode", event.target.value as FormState["privacyMode"])} className={inputClass}>
                <option value="exact">Exact address</option>
                <option value="approximate">Approximate area</option>
                <option value="hidden">Hidden</option>
              </select>
            </Field>
            <Field label="Airport note — English">
              <input value={form.airportEn} onChange={(event) => set("airportEn", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Airport note — Spanish">
              <input value={form.airportEs} onChange={(event) => set("airportEs", event.target.value)} className={inputClass} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Agency and agent">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Agency name">
              <input required value={form.agencyName} onChange={(event) => set("agencyName", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Agent name">
              <input value={form.agentName} onChange={(event) => set("agentName", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Role — English">
              <input value={form.roleEn} onChange={(event) => set("roleEn", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Role — Spanish">
              <input value={form.roleEs} onChange={(event) => set("roleEs", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={(event) => set("phone", event.target.value)} className={inputClass} />
            </Field>
            <Field label="WhatsApp">
              <input value={form.whatsapp} onChange={(event) => set("whatsapp", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Website">
              <input value={form.website} onChange={(event) => set("website", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Logo URL">
              <input value={form.logoUrl} onChange={(event) => set("logoUrl", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Portrait URL">
              <input value={form.portraitUrl} onChange={(event) => set("portraitUrl", event.target.value)} className={inputClass} />
            </Field>
          </div>
        </FormSection>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border bg-surface px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-bold text-primary transition hover:border-primary/40 disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-light disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {saving ? "Saving…" : mode === "create" ? "Create property" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-4 border-b border-border pb-2 text-xs font-bold uppercase tracking-[0.16em] text-secondary-dark">
        {title}
      </h3>
      {children}
    </section>
  );
}
