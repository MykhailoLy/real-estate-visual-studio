"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, FileText, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  LANGUAGE_CHANGE_EVENT,
  getCurrentLanguage,
  readStoredLanguage,
  type SiteLanguage,
} from "@/components/layout/Header";
import { listOrderDrafts } from "@/lib/order-drafts/client";
import {
  buildSavedDraftResumeUrl,
  formatSavedDraftUpdatedAt,
  getSavedDraftTitle,
  resolveSavedDraftServiceName,
} from "@/lib/order-drafts/saved-drafts";
import type { OrderDraftSummary } from "@/lib/order-drafts/types";

type LoadState = "loading" | "success" | "error";

interface DraftCopy {
  heading: string;
  helper: string;
  badge: string;
  updated: string;
  resume: string;
  untitled: string;
  error: string;
  retry: string;
  updatedUnavailable: string;
  loading: string;
  viewAll: string;
}

const DRAFT_COPY: Record<SiteLanguage, DraftCopy> = {
  en: {
    heading: "Saved drafts",
    helper: "Continue where you left off.",
    badge: "Draft",
    updated: "Updated",
    resume: "Resume",
    untitled: "Untitled draft",
    error: "Drafts could not be loaded.",
    retry: "Retry",
    updatedUnavailable: "Updated time unavailable",
    loading: "Loading saved drafts",
    viewAll: "View all drafts",
  },
  es: {
    heading: "Borradores guardados",
    helper: "Continúa donde lo dejaste.",
    badge: "Borrador",
    updated: "Actualizado",
    resume: "Continuar",
    untitled: "Borrador sin título",
    error: "No se pudieron cargar los borradores.",
    retry: "Reintentar",
    updatedUnavailable: "Hora de actualización no disponible",
    loading: "Cargando borradores guardados",
    viewAll: "Ver todos los borradores",
  },
};

function LoadingCard() {
  return (
    <li className="rounded-lg border border-border bg-white p-4">
      <div className="h-4 w-20 rounded bg-stone-100" />
      <div className="mt-4 h-5 w-3/4 rounded bg-stone-100" />
      <div className="mt-3 h-4 w-1/2 rounded bg-stone-100" />
      <div className="mt-5 h-9 w-24 rounded bg-stone-100" />
    </li>
  );
}

export default function SavedDraftsSection() {
  const pathname = usePathname();
  const [savedLanguage, setSavedLanguage] = useState<SiteLanguage | null>(null);
  const language = getCurrentLanguage(pathname, savedLanguage);
  const copy = DRAFT_COPY[language];
  const [drafts, setDrafts] = useState<OrderDraftSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    window.queueMicrotask(() => setSavedLanguage(readStoredLanguage()));
    const onLanguageChange = (event: Event) => {
      const detail = (event as CustomEvent<{ language?: unknown }>).detail;
      setSavedLanguage(detail?.language === "es" ? "es" : "en");
    };
    window.addEventListener(LANGUAGE_CHANGE_EVENT, onLanguageChange);
    return () => window.removeEventListener(LANGUAGE_CHANGE_EVENT, onLanguageChange);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    listOrderDrafts(3, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result.ok) {
          setLoadState("error");
          return;
        }
        setDrafts(result.data.slice(0, 3));
        setLoadState("success");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState("error");
      });

    return () => controller.abort();
  }, [reloadKey]);

  const retry = useCallback(() => {
    setLoadState("loading");
    setReloadKey((key) => key + 1);
  }, []);

  if (loadState === "success" && drafts.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="saved-drafts-heading"
      aria-busy={loadState === "loading"}
      className="mb-8"
    >
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="saved-drafts-heading"
            className="text-lg font-bold leading-tight text-primary"
          >
            {copy.heading}
          </h2>
          <p className="text-sm text-muted">{copy.helper}</p>
        </div>
        {loadState === "success" && drafts.length > 0 && (
          <Link
            href="/dashboard/drafts"
            className="inline-flex w-fit items-center rounded-lg border border-primary/20 bg-white px-3.5 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {copy.viewAll}
          </Link>
        )}
      </div>

      {loadState === "loading" && (
        <div role="status" aria-label={copy.loading}>
          <span className="sr-only">{copy.loading}</span>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </ul>
        </div>
      )}

      {loadState === "error" && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-muted">{copy.error}</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-sm font-bold text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {copy.retry}
          </button>
        </div>
      )}

      {loadState === "success" && drafts.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {drafts.map((draft) => {
            const resumeUrl = buildSavedDraftResumeUrl(draft.route, draft.id);
            const title = getSavedDraftTitle(draft.title, copy.untitled);
            const serviceName = resolveSavedDraftServiceName(draft);
            const updatedAt = formatSavedDraftUpdatedAt(
              draft.updatedAt,
              language,
              copy.updatedUnavailable,
            );

            return (
              <li key={draft.id} className="flex">
                <article className="flex w-full flex-col rounded-lg border border-border bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-2.5 py-1 text-[11px] font-bold uppercase text-secondary-dark">
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      {copy.badge}
                    </span>
                  </div>
                  <h3 className="line-clamp-2 text-base font-bold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-primary">
                    {serviceName}
                  </p>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden />
                    <span className="font-semibold">{copy.updated}</span>
                    <span>{updatedAt}</span>
                  </p>
                  {resumeUrl && (
                    <Link
                      href={resumeUrl}
                      className="mt-4 inline-flex w-fit items-center rounded-lg border border-primary/20 bg-white px-3.5 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      {copy.resume}
                    </Link>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
