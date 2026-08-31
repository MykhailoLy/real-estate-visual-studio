"use client";

import { usePathname } from "next/navigation";
import { ArrowRight, Clock3, FileText, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ClientPortalLink from "./ClientPortalLink";
import DraftThumbnail from "@/components/dashboard/DraftThumbnail";
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
  getSavedDraftActionLabel,
  getSavedDraftStatusLabel,
  getSavedDraftTitle,
  isFinishingOrderDraft,
  resolveSavedDraftServiceName,
} from "@/lib/order-drafts/saved-drafts";
import type { OrderDraftSummary } from "@/lib/order-drafts/types";
import { cn } from "@/lib/utils";

type LoadState = "loading" | "success" | "error";
type SavedDraftsVariant = "grid" | "rail";

interface SavedDraftsSectionProps {
  variant?: SavedDraftsVariant;
  heading?: string;
  helper?: string;
  carded?: boolean;
}

interface DraftCopy {
  heading: string;
  helper: string;
  badge: string;
  finishingBadge: string;
  updated: string;
  resume: string;
  finish: string;
  order: string;
  untitled: string;
  error: string;
  retry: string;
  updatedUnavailable: string;
  loading: string;
  viewAll: string;
  empty: string;
}

const DRAFT_COPY: Record<SiteLanguage, DraftCopy> = {
  en: {
    heading: "Saved drafts",
    helper: "Continue where you left off.",
    badge: "Draft",
    finishingBadge: "Finishing order",
    updated: "Updated",
    resume: "Resume",
    finish: "Finish",
    order: "Order",
    untitled: "Untitled draft",
    error: "Drafts could not be loaded.",
    retry: "Retry",
    updatedUnavailable: "Updated time unavailable",
    loading: "Loading saved drafts",
    viewAll: "View all drafts",
    empty: "No saved drafts right now.",
  },
  es: {
    heading: "Borradores guardados",
    helper: "Continúa donde lo dejaste.",
    badge: "Borrador",
    finishingBadge: "Finalizando pedido",
    updated: "Actualizado",
    resume: "Continuar",
    finish: "Finalizar",
    order: "Pedido",
    untitled: "Borrador sin título",
    error: "No se pudieron cargar los borradores.",
    retry: "Reintentar",
    updatedUnavailable: "Hora de actualización no disponible",
    loading: "Cargando borradores guardados",
    viewAll: "Ver todos los borradores",
    empty: "No hay borradores guardados ahora.",
  },
};

function LoadingCard({
  variant,
  carded,
}: {
  variant: SavedDraftsVariant;
  carded?: boolean;
}) {
  if (variant === "rail") {
    return (
      <li
        className={cn(
          carded
            ? "rounded-xl border border-border bg-white p-4"
            : "border-t border-border py-3 first:border-t-0 first:pt-0",
        )}
      >
        <div className="h-4 w-2/3 rounded bg-stone-100" />
        <div className="mt-2 h-3 w-1/2 rounded bg-stone-100" />
        <div className="mt-3 h-11 w-24 rounded bg-stone-100" />
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border bg-white p-4">
      <div className="h-4 w-20 rounded bg-stone-100" />
      <div className="mt-4 h-5 w-3/4 rounded bg-stone-100" />
      <div className="mt-3 h-4 w-1/2 rounded bg-stone-100" />
      <div className="mt-5 h-9 w-24 rounded bg-stone-100" />
    </li>
  );
}

export default function SavedDraftsSection({
  variant = "grid",
  heading,
  helper,
  carded = false,
}: SavedDraftsSectionProps) {
  const pathname = usePathname();
  const [savedLanguage, setSavedLanguage] = useState<SiteLanguage | null>(null);
  const language = getCurrentLanguage(pathname, savedLanguage);
  const copy = DRAFT_COPY[language];
  const resolvedHeading = heading ?? copy.heading;
  const resolvedHelper = helper ?? copy.helper;
  const [drafts, setDrafts] = useState<OrderDraftSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const isRail = variant === "rail";
  const headingId = isRail ? "saved-drafts-rail-heading" : "saved-drafts-heading";

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

  if (loadState === "success" && drafts.length === 0 && !isRail) {
    return null;
  }

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={loadState === "loading"}
      className={cn(!isRail && "mb-8")}
    >
      <div
        className={cn(
          "flex gap-3",
          isRail
            ? "mb-3 items-start justify-between"
            : "mb-3 flex-col sm:flex-row sm:items-end sm:justify-between",
        )}
      >
        <div className="min-w-0">
          {isRail ? (
            <h2
              id={headingId}
              className={cn(
                carded
                  ? "text-[11px] font-bold uppercase tracking-[0.18em] text-primary"
                  : "text-sm font-bold text-primary",
              )}
            >
              {resolvedHeading}
            </h2>
          ) : (
            <h2
              id={headingId}
              className="text-lg font-bold leading-tight text-primary"
            >
              {resolvedHeading}
            </h2>
          )}
          {resolvedHelper && (
            <p
              className={cn(
                "text-muted",
                isRail ? "mt-1 text-xs leading-relaxed" : "text-sm",
              )}
            >
              {resolvedHelper}
            </p>
          )}
        </div>
        {loadState === "success" && drafts.length > 0 && (
          <ClientPortalLink
            href="/dashboard/drafts"
            className={cn(
              "inline-flex min-h-11 w-fit flex-shrink-0 items-center rounded-lg font-bold text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              isRail
                ? "px-2 text-xs hover:bg-surface"
                : "border border-primary/20 bg-white px-3.5 py-2 text-sm hover:bg-primary hover:text-white",
            )}
          >
            {copy.viewAll}
          </ClientPortalLink>
        )}
      </div>

      {loadState === "loading" && (
        <div role="status" aria-label={copy.loading}>
          <span className="sr-only">{copy.loading}</span>
          <ul
            className={cn(
              isRail
                ? carded
                  ? "space-y-3"
                  : "divide-y divide-border"
                : "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3",
            )}
          >
            <LoadingCard variant={variant} carded={carded} />
            <LoadingCard variant={variant} carded={carded} />
            <LoadingCard variant={variant} carded={carded} />
          </ul>
        </div>
      )}

      {loadState === "error" && (
        <div
          className={cn(
            "flex gap-3 border border-border bg-white",
            isRail
              ? "flex-col rounded-lg p-3"
              : "flex-col rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          <p className="text-sm font-medium text-muted">{copy.error}</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-sm font-bold text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {copy.retry}
          </button>
        </div>
      )}

      {loadState === "success" && drafts.length === 0 && isRail && (
        <p className="rounded-lg bg-surface p-3 text-xs leading-relaxed text-muted">
          {copy.empty}
        </p>
      )}

      {loadState === "success" && drafts.length > 0 && (
        <ul
          className={cn(
            isRail
              ? carded
                ? "space-y-3"
                : "divide-y divide-border"
              : "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3",
          )}
        >
          {drafts.map((draft) => (
            <SavedDraftItem
              key={draft.id}
              draft={draft}
              copy={copy}
              language={language}
              variant={variant}
              carded={carded}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function SavedDraftItem({
  draft,
  copy,
  language,
  variant,
  carded,
}: {
  draft: OrderDraftSummary;
  copy: DraftCopy;
  language: SiteLanguage;
  variant: SavedDraftsVariant;
  carded: boolean;
}) {
  const resumeUrl = buildSavedDraftResumeUrl(draft.route, draft.id);
  const title = getSavedDraftTitle(draft.title, copy.untitled);
  const serviceName = resolveSavedDraftServiceName(draft);
  const updatedAt = formatSavedDraftUpdatedAt(
    draft.updatedAt,
    language,
    copy.updatedUnavailable,
  );
  const isFinishing = isFinishingOrderDraft(draft);
  const badgeLabel = getSavedDraftStatusLabel(draft, {
    draft: copy.badge,
    finishing: copy.finishingBadge,
  });
  const actionLabel = getSavedDraftActionLabel(draft, {
    resume: copy.resume,
    finish: copy.finish,
  });

  if (variant === "rail") {
    return (
      <li
        className={cn(
          carded
            ? "rounded-xl border border-border bg-white p-4 shadow-sm"
            : "py-3 first:pt-0 last:pb-0",
        )}
      >
        <article className="min-w-0">
          <div className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md",
                isFinishing
                  ? "bg-amber-100 text-amber-700"
                  : "bg-secondary/10 text-secondary-dark",
              )}
              aria-label={badgeLabel}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
                {title}
              </h4>
              <p className="mt-0.5 truncate text-xs font-medium text-primary">
                {serviceName}
              </p>
              {draft.finalization && (
                <p className="mt-0.5 truncate text-[11px] text-muted">
                  {copy.order}: {draft.finalization.orderNumber}
                </p>
              )}
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted">
                <Clock3 className="h-3 w-3 flex-shrink-0" aria-hidden />
                <span className="truncate">{updatedAt}</span>
              </p>
            </div>
          </div>
          {resumeUrl && (
            <ClientPortalLink
              href={resumeUrl}
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {actionLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </ClientPortalLink>
          )}
        </article>
      </li>
    );
  }

  return (
    <li className="flex">
      <article className="flex w-full flex-col rounded-lg border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row">
          <DraftThumbnail draft={draft} title={title} />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase",
                  isFinishing
                    ? "bg-amber-100 text-amber-800"
                    : "bg-secondary/10 text-secondary-dark",
                )}
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                {badgeLabel}
              </span>
            </div>
            <h3 className="line-clamp-2 text-base font-bold text-foreground">
              {title}
            </h3>
            <p className="mt-1 text-sm font-medium text-primary">
              {serviceName}
            </p>
            {draft.finalization && (
              <p className="mt-1 text-xs font-medium text-muted">
                {copy.order}: {draft.finalization.orderNumber}
              </p>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              <span className="font-semibold">{copy.updated}</span>
              <span>{updatedAt}</span>
            </p>
            {resumeUrl && (
              <ClientPortalLink
                href={resumeUrl}
                className="mt-4 inline-flex w-fit items-center rounded-lg border border-primary/20 bg-white px-3.5 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {actionLabel}
              </ClientPortalLink>
            )}
          </div>
        </div>
      </article>
    </li>
  );
}
