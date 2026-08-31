"use client";

import { usePathname } from "next/navigation";
import { ArrowRight, Clock3, FileText, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ClientPortalLink from "./ClientPortalLink";
import {
  OrderDraftDeletionDialog,
  useOrderDraftDeletion,
  type DraftDeleteCopy,
} from "./ClientDraftsPage";
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
import { CLIENT_PORTAL_QA_DRAFTS } from "@/lib/client-portal-qa-fixtures";
import { cn } from "@/lib/utils";
import { useDashboardUser } from "./DashboardUserContext";

type LoadState = "loading" | "success" | "error";
type SavedDraftsVariant = "grid" | "rail";

interface SavedDraftsSectionProps {
  variant?: SavedDraftsVariant;
  heading?: string;
  helper?: string;
  panel?: boolean;
  deletable?: boolean;
  listLimit?: number;
  className?: string;
}

interface DraftCopy extends DraftDeleteCopy {
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
    delete: "Delete",
    confirmTitle: "Delete this draft?",
    confirmMessage:
      "This removes the saved draft. It does not affect submitted orders.",
    cancel: "Cancel",
    confirmDelete: "Delete draft",
    deleting: "Deleting...",
    deleted: "Draft deleted",
    deleteFailed: "Draft could not be deleted. Try again.",
    conflict:
      "This draft changed in another tab. The list was refreshed. Review it and try again.",
    unavailable: "This draft is no longer available. The list was refreshed.",
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
    delete: "Eliminar",
    confirmTitle: "¿Eliminar este borrador?",
    confirmMessage:
      "Esta acción elimina el borrador guardado. No afecta a los pedidos enviados.",
    cancel: "Cancelar",
    confirmDelete: "Eliminar borrador",
    deleting: "Eliminando...",
    deleted: "Borrador eliminado.",
    deleteFailed: "No se pudo eliminar el borrador. Inténtalo de nuevo.",
    conflict:
      "Este borrador cambió en otra pestaña. La lista se actualizó. Revísalo e inténtalo de nuevo.",
    unavailable: "Este borrador ya no está disponible. La lista se actualizó.",
  },
};

function LoadingCard({
  variant,
  panel,
}: {
  variant: SavedDraftsVariant;
  panel?: boolean;
}) {
  if (variant === "rail") {
    return (
      <li
        className={cn(
          panel
            ? "px-4 py-3"
            : "border-t border-border py-3 first:border-t-0",
        )}
      >
        <div className="h-4 w-2/3 rounded bg-stone-100" />
        <div className="mt-1.5 h-3 w-4/5 rounded bg-stone-100" />
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
  panel = false,
  deletable = false,
  listLimit = 3,
  className,
}: SavedDraftsSectionProps) {
  const pathname = usePathname();
  const user = useDashboardUser();
  const isQaPreview = user?.isQaPreview === true;
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
  const visibleDrafts = isQaPreview
    ? CLIENT_PORTAL_QA_DRAFTS.slice(0, listLimit)
    : drafts;
  const visibleLoadState: LoadState = isQaPreview ? "success" : loadState;

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
    if (isQaPreview) return;

    const controller = new AbortController();

    listOrderDrafts(listLimit, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result.ok) {
          setLoadState("error");
          return;
        }
        setDrafts(result.data.slice(0, listLimit));
        setLoadState("success");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState("error");
      });

    return () => controller.abort();
  }, [isQaPreview, listLimit, reloadKey]);

  const retry = useCallback(() => {
    setLoadState("loading");
    setReloadKey((key) => key + 1);
  }, []);
  const handleDeleteRefreshSuccess = useCallback(() => {
    setLoadState("success");
  }, []);
  const deletion = useOrderDraftDeletion({
    drafts: isQaPreview ? [] : drafts,
    setDrafts,
    copy,
    listLimit,
    loginRedirect: "/login?redirectTo=%2Fdashboard",
    onRefreshSuccess: handleDeleteRefreshSuccess,
  });

  if (visibleLoadState === "success" && visibleDrafts.length === 0 && !isRail) {
    return null;
  }

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={visibleLoadState === "loading"}
      data-dashboard-section={panel ? "awaiting-submission" : undefined}
      className={cn(
        !isRail && "mb-8",
        panel &&
          "overflow-hidden rounded-xl border border-border bg-white shadow-sm",
        className,
      )}
    >
      <div
        className={cn(
          "flex gap-3",
          isRail && panel && "flex-wrap",
          isRail
            ? panel
              ? "items-start justify-between border-b border-border px-4 py-4"
              : "mb-3 items-start justify-between"
            : "mb-3 flex-col sm:flex-row sm:items-end sm:justify-between",
        )}
      >
        <div
          className={cn(
            "min-w-0",
            isRail && panel && "min-w-[7rem] flex-1",
          )}
        >
          {isRail ? (
            <h2
              id={headingId}
              className={cn(
                panel
                  ? "text-[11px] font-bold uppercase tracking-[0.18em] text-secondary"
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
        {visibleLoadState === "success" && visibleDrafts.length > 0 && !panel && (
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

      <div aria-live="polite" className="sr-only">
        {deletion.statusMessage}
      </div>
      {deletion.statusMessage && (
        <p
          className={cn(
            "text-sm font-medium text-muted",
            panel
              ? "border-b border-border px-4 py-3"
              : "mb-3 rounded-lg border border-border bg-white p-3",
          )}
        >
          {deletion.statusMessage}
        </p>
      )}

      {visibleLoadState === "loading" && (
        <div role="status" aria-label={copy.loading}>
          <span className="sr-only">{copy.loading}</span>
          <ul
            className={cn(
              isRail
                ? "divide-y divide-border"
                : "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3",
            )}
          >
            <LoadingCard variant={variant} panel={panel} />
            <LoadingCard variant={variant} panel={panel} />
            <LoadingCard variant={variant} panel={panel} />
          </ul>
        </div>
      )}

      {visibleLoadState === "error" && (
        <div
          className={cn(
            "flex gap-3",
            isRail
              ? panel
                ? "m-4 flex-col rounded-lg bg-surface p-3"
                : "flex-col rounded-lg border border-border bg-white p-3"
              : "flex-col rounded-lg border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between",
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

      {visibleLoadState === "success" && visibleDrafts.length === 0 && isRail && (
        <p
          className={cn(
            "bg-surface text-xs leading-relaxed text-muted",
            panel ? "px-4 py-5" : "rounded-lg p-3",
          )}
        >
          {copy.empty}
        </p>
      )}

      {visibleLoadState === "success" && visibleDrafts.length > 0 && (
        <ul
          className={cn(
            isRail
              ? "divide-y divide-border"
              : "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3",
          )}
        >
          {visibleDrafts.map((draft) => (
            <SavedDraftItem
              key={draft.id}
              draft={draft}
              copy={copy}
              language={language}
              variant={variant}
              panel={panel}
              deletable={deletable}
              isQaPreview={isQaPreview}
              deleteInteractionDisabled={deletion.deleteInteractionDisabled}
              error={deletion.cardErrors[draft.id] ?? ""}
              onDelete={(trigger) => deletion.beginDelete(draft, trigger)}
            />
          ))}
        </ul>
      )}

      {visibleLoadState === "success" && visibleDrafts.length > 0 && panel && (
        <div className="border-t border-border px-3 py-2">
          <ClientPortalLink
            href="/dashboard/drafts"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {copy.viewAll}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </ClientPortalLink>
        </div>
      )}

      <OrderDraftDeletionDialog controller={deletion} copy={copy} />

      {deletion.toastMessage && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          {deletion.toastMessage}
        </div>
      )}
    </section>
  );
}

function SavedDraftItem({
  draft,
  copy,
  language,
  variant,
  panel,
  deletable,
  isQaPreview,
  deleteInteractionDisabled,
  error,
  onDelete,
}: {
  draft: OrderDraftSummary;
  copy: DraftCopy;
  language: SiteLanguage;
  variant: SavedDraftsVariant;
  panel: boolean;
  deletable: boolean;
  isQaPreview: boolean;
  deleteInteractionDisabled: boolean;
  error: string;
  onDelete: (trigger: HTMLButtonElement) => void;
}) {
  const resumeUrl = isQaPreview
    ? draft.route
    : buildSavedDraftResumeUrl(draft.route, draft.id);
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
        className={cn(panel ? "px-2 py-2" : "py-2 first:pt-0 last:pb-0")}
      >
        <article className="min-w-0">
          <div className="flex items-center gap-1">
            {resumeUrl ? (
              <ClientPortalLink
                href={resumeUrl}
                aria-label={`${actionLabel}: ${title}`}
                className="group flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 transition-colors hover:bg-ivory focus:outline-none focus-visible:bg-ivory focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold leading-snug text-foreground transition-colors group-hover:text-primary group-focus-visible:text-primary">
                    {title}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-muted">
                    <span className="max-w-[45%] truncate font-medium text-primary">
                      {serviceName}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="min-w-0 truncate">
                      {copy.updated} {updatedAt}
                    </span>
                  </span>
                </span>
                <span className="hidden items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted transition-colors group-hover:text-primary group-focus-visible:text-primary sm:inline-flex">
                  {actionLabel}
                </span>
                <ArrowRight
                  className="h-3.5 w-3.5 flex-shrink-0 text-muted-light transition-transform group-hover:translate-x-0.5 group-hover:text-primary group-focus-visible:translate-x-0.5 group-focus-visible:text-primary"
                  aria-hidden
                />
              </ClientPortalLink>
            ) : (
              <div className="min-h-11 min-w-0 flex-1 px-2 py-1">
                <p className="truncate text-sm font-bold leading-snug text-foreground">
                  {title}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted">
                  {serviceName} · {copy.updated} {updatedAt}
                </p>
              </div>
            )}
            {deletable && !isFinishing && !isQaPreview && (
              <button
                type="button"
                onClick={(event) => onDelete(event.currentTarget)}
                disabled={deleteInteractionDisabled}
                aria-label={`${copy.delete}: ${title}`}
                title={copy.delete}
                className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
          {error && (
            <p aria-live="polite" className="mt-2 text-xs font-medium text-red-700">
              {error}
            </p>
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
