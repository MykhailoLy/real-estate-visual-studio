"use client";

import ClientPortalLink from "./ClientPortalLink";
import { usePathname, useRouter } from "next/navigation";
import { Clock3, FileText, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import DraftThumbnail from "@/components/dashboard/DraftThumbnail";
import {
  LANGUAGE_CHANGE_EVENT,
  getCurrentLanguage,
  readStoredLanguage,
  type SiteLanguage,
} from "@/components/layout/Header";
import {
  deleteOrderDraft,
  listOrderDrafts,
  type OrderDraftClientErrorCode,
} from "@/lib/order-drafts/client";
import { removeDraftSummaryById, shouldRefreshDraftListAfterDeleteError } from "@/lib/order-drafts/drafts-page";
import {
  buildSavedDraftResumeUrl,
  formatSavedDraftUpdatedAt,
  getSavedDraftActionLabel,
  getSavedDraftStatusLabel,
  getSavedDraftTitle,
  isFinishingOrderDraft,
  resolveSavedDraftServiceName,
} from "@/lib/order-drafts/saved-drafts";
import { cn } from "@/lib/utils";
import type { OrderDraftSummary } from "@/lib/order-drafts/types";

type LoadState = "loading" | "success" | "error";
type DeleteRefreshResult = "refreshed" | "failed" | "redirected" | "aborted";

interface DraftsPageCopy {
  heading: string;
  helper: string;
  badge: string;
  finishingBadge: string;
  updated: string;
  resume: string;
  finish: string;
  order: string;
  delete: string;
  confirmTitle: string;
  confirmMessage: string;
  cancel: string;
  confirmDelete: string;
  deleting: string;
  untitled: string;
  loadError: string;
  retry: string;
  updatedUnavailable: string;
  emptyTitle: string;
  emptyMessage: string;
  startOrder: string;
  loading: string;
  deleted: string;
  deleteFailed: string;
  conflict: string;
  unavailable: string;
}

const DRAFTS_COPY: Record<SiteLanguage, DraftsPageCopy> = {
  en: {
    heading: "Drafts",
    helper: "Continue editing or remove saved orders you no longer need.",
    badge: "Draft",
    finishingBadge: "Finishing order",
    updated: "Updated",
    resume: "Resume",
    finish: "Finish",
    order: "Order",
    delete: "Delete",
    confirmTitle: "Delete this draft?",
    confirmMessage:
      "This removes the saved draft. It does not affect submitted orders.",
    cancel: "Cancel",
    confirmDelete: "Delete draft",
    deleting: "Deleting...",
    untitled: "Untitled draft",
    loadError: "Drafts could not be loaded.",
    retry: "Retry",
    updatedUnavailable: "Updated time unavailable",
    emptyTitle: "No saved drafts",
    emptyMessage:
      "Start a new order and your progress will appear here automatically.",
    startOrder: "Start a new order",
    loading: "Loading drafts",
    deleted: "Draft deleted",
    deleteFailed: "Draft could not be deleted. Try again.",
    conflict:
      "This draft changed in another tab. The list was refreshed. Review it and try again.",
    unavailable: "This draft is no longer available. The list was refreshed.",
  },
  es: {
    heading: "Borradores",
    helper: "Continúa editando o elimina los pedidos guardados que ya no necesites.",
    badge: "Borrador",
    finishingBadge: "Finalizando pedido",
    updated: "Actualizado",
    resume: "Continuar",
    finish: "Finalizar",
    order: "Pedido",
    delete: "Eliminar",
    confirmTitle: "¿Eliminar este borrador?",
    confirmMessage:
      "Esta acción elimina el borrador guardado. No afecta a los pedidos enviados.",
    cancel: "Cancelar",
    confirmDelete: "Eliminar borrador",
    deleting: "Eliminando...",
    untitled: "Borrador sin título",
    loadError: "No se pudieron cargar los borradores.",
    retry: "Reintentar",
    updatedUnavailable: "Hora de actualización no disponible",
    emptyTitle: "No hay borradores guardados",
    emptyMessage:
      "Empieza un nuevo pedido y tu progreso aparecerá aquí automáticamente.",
    startOrder: "Crear un nuevo pedido",
    loading: "Cargando borradores",
    deleted: "Borrador eliminado.",
    deleteFailed: "No se pudo eliminar el borrador. Inténtalo de nuevo.",
    conflict:
      "Este borrador cambió en otra pestaña. La lista se actualizó. Revísalo e inténtalo de nuevo.",
    unavailable: "Este borrador ya no está disponible. La lista se actualizó.",
  },
};

const LOGIN_REDIRECT = "/login?redirectTo=%2Fdashboard%2Fdrafts";

function LoadingCard() {
  return (
    <li className="rounded-lg border border-border bg-white p-4">
      <div className="h-4 w-20 rounded bg-stone-100" />
      <div className="mt-4 h-5 w-3/4 rounded bg-stone-100" />
      <div className="mt-3 h-4 w-1/2 rounded bg-stone-100" />
      <div className="mt-5 h-9 w-32 rounded bg-stone-100" />
    </li>
  );
}

export default function ClientDraftsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [savedLanguage, setSavedLanguage] = useState<SiteLanguage | null>(null);
  const language = getCurrentLanguage(pathname, savedLanguage);
  const copy = DRAFTS_COPY[language];
  const [drafts, setDrafts] = useState<OrderDraftSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmDraftId, setConfirmDraftId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const mountedRef = useRef(true);
  const activeDeleteControllerRef = useRef<AbortController | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement | null>(null);
  const deleteDialogRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeDeleteControllerRef.current?.abort();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!confirmDraftId) return;

    const focusFrame = window.requestAnimationFrame(() => {
      cancelDeleteRef.current?.focus();
    });
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !activeDeleteControllerRef.current) {
        event.preventDefault();
        setConfirmDraftId(null);
        window.requestAnimationFrame(() => deleteTriggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        deleteDialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled])",
        ) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [confirmDraftId]);

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

    listOrderDrafts(100, controller.signal)
      .then((result) => {
        if (controller.signal.aborted || !mountedRef.current) return;
        if (!result.ok) {
          if (result.code === "unauthenticated") {
            router.push(LOGIN_REDIRECT);
            return;
          }
          setLoadState("error");
          return;
        }
        setDrafts(result.data);
        setLoadState("success");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!mountedRef.current) return;
        setLoadState("error");
      });

    return () => controller.abort();
  }, [reloadKey, router]);

  const retry = useCallback(() => {
    setLoadState("loading");
    setReloadKey((key) => key + 1);
  }, []);

  const refreshDraftsAfterDeleteError = useCallback(async (
    signal: AbortSignal,
  ): Promise<DeleteRefreshResult> => {
    try {
      const result = await listOrderDrafts(100, signal);
      if (signal.aborted || !mountedRef.current) return "aborted";
      if (!result.ok) {
        if (result.code === "unauthenticated") {
          router.push(LOGIN_REDIRECT);
          return "redirected";
        }
        return "failed";
      }
      setDrafts(result.data);
      setLoadState("success");
      return "refreshed";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "aborted";
      }
      return "failed";
    }
  }, [router]);

  const beginDelete = (draftId: string, trigger: HTMLButtonElement) => {
    if (activeDeleteControllerRef.current) return;
    deleteTriggerRef.current = trigger;
    setConfirmDraftId(draftId);
    setCardErrors({});
    setStatusMessage("");
  };

  const cancelDelete = () => {
    if (activeDeleteControllerRef.current) return;
    setConfirmDraftId(null);
    window.requestAnimationFrame(() => deleteTriggerRef.current?.focus());
  };

  const confirmDelete = async (draft: OrderDraftSummary) => {
    if (deletingDraftId || activeDeleteControllerRef.current) return;
    const controller = new AbortController();
    activeDeleteControllerRef.current = controller;
    setDeletingDraftId(draft.id);
    setCardErrors({});
    setStatusMessage("");

    try {
      const result = await deleteOrderDraft(
        draft.id,
        draft.version,
        controller.signal,
      );
      if (!mountedRef.current) return;

      if (result.ok) {
        setDrafts((current) => removeDraftSummaryById(current, draft.id));
        setConfirmDraftId(null);
        setToastMessage(copy.deleted);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
          if (mountedRef.current) setToastMessage("");
        }, 3500);
        return;
      }

      if (result.code === "unauthenticated") {
        router.push(LOGIN_REDIRECT);
        return;
      }

      if (shouldRefreshDraftListAfterDeleteError(result.code)) {
        setConfirmDraftId(null);
        window.requestAnimationFrame(() => deleteTriggerRef.current?.focus());
        const refreshResult = await refreshDraftsAfterDeleteError(
          controller.signal,
        );
        if (!mountedRef.current || refreshResult === "aborted") return;
        if (refreshResult === "refreshed") {
          setStatusMessage(
            getRefreshMessageForDeleteError(result.code, copy),
          );
          return;
        }
        if (refreshResult === "failed") {
          setCardErrors({ [draft.id]: copy.deleteFailed });
        }
        return;
      }

      setCardErrors({ [draft.id]: copy.deleteFailed });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (!mountedRef.current) return;
      setCardErrors({ [draft.id]: copy.deleteFailed });
    } finally {
      const ownsActiveDelete = activeDeleteControllerRef.current === controller;
      if (ownsActiveDelete) {
        activeDeleteControllerRef.current = null;
      }
      if (mountedRef.current && ownsActiveDelete) setDeletingDraftId(null);
    }
  };

  const confirmDraft =
    drafts.find((draft) => draft.id === confirmDraftId) ?? null;

  return (
    <section aria-labelledby="drafts-page-heading" className="space-y-6">
      <div>
        <h1
          id="drafts-page-heading"
          className="text-2xl font-bold leading-tight text-primary sm:text-[28px]"
        >
          {copy.heading}
        </h1>
        <p className="mt-1 text-sm text-muted">{copy.helper}</p>
      </div>

      <div aria-live="polite" className="sr-only">
        {statusMessage}
      </div>
      {statusMessage && (
        <p className="rounded-lg border border-border bg-white p-3 text-sm font-medium text-muted">
          {statusMessage}
        </p>
      )}

      {loadState === "loading" && (
        <div aria-busy="true" role="status" aria-label={copy.loading}>
          <span className="sr-only">{copy.loading}</span>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </ul>
        </div>
      )}

      {loadState === "error" && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-muted">{copy.loadError}</p>
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

      {loadState === "success" && drafts.length === 0 && (
        <div className="rounded-lg border border-border bg-white p-6 text-center">
          <h2 className="text-lg font-bold text-primary">{copy.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {copy.emptyMessage}
          </p>
          <ClientPortalLink
            href="/dashboard/orders/new"
            className="mt-5 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {copy.startOrder}
          </ClientPortalLink>
        </div>
      )}

      {loadState === "success" && drafts.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {drafts.map((draft) => (
            <li key={draft.id} className="flex">
              <DraftCard
                draft={draft}
                copy={copy}
                language={language}
                deleteInteractionDisabled={deletingDraftId !== null}
                error={cardErrors[draft.id] ?? ""}
                onDelete={(trigger) => beginDelete(draft.id, trigger)}
              />
            </li>
          ))}
        </ul>
      )}

      {confirmDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/35 p-4"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !activeDeleteControllerRef.current
            ) {
              cancelDelete();
            }
          }}
        >
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-draft-title"
            aria-describedby="delete-draft-description"
            aria-busy={deletingDraftId === confirmDraft.id}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-xl border border-border bg-white p-5 shadow-xl"
          >
            <h2
              id="delete-draft-title"
              className="text-lg font-bold text-primary"
            >
              {copy.confirmTitle}
            </h2>
            <p
              id="delete-draft-description"
              className="mt-2 text-sm leading-relaxed text-muted"
            >
              {copy.confirmMessage}
            </p>
            {cardErrors[confirmDraft.id] && (
              <p role="alert" className="mt-3 text-sm font-medium text-red-700">
                {cardErrors[confirmDraft.id]}
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={cancelDeleteRef}
                type="button"
                onClick={cancelDelete}
                disabled={deletingDraftId === confirmDraft.id}
                className="inline-flex items-center justify-center rounded-lg border border-border bg-white px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete(confirmDraft)}
                disabled={deletingDraftId === confirmDraft.id}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {deletingDraftId === confirmDraft.id
                  ? copy.deleting
                  : copy.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          {toastMessage}
        </div>
      )}
    </section>
  );
}

function getRefreshMessageForDeleteError(
  code: OrderDraftClientErrorCode,
  copy: DraftsPageCopy,
): string {
  if (code === "version_conflict") return copy.conflict;
  return copy.unavailable;
}

function DraftCard({
  draft,
  copy,
  language,
  deleteInteractionDisabled,
  error,
  onDelete,
}: {
  draft: OrderDraftSummary;
  copy: DraftsPageCopy;
  language: SiteLanguage;
  deleteInteractionDisabled: boolean;
  error: string;
  onDelete: (trigger: HTMLButtonElement) => void;
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

  return (
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

          <h2 className="line-clamp-2 text-base font-bold text-foreground">
            {title}
          </h2>
          <p className="mt-1 text-sm font-medium text-primary">{serviceName}</p>
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

          <div className="mt-auto pt-4">
            <div className="flex flex-wrap gap-2">
              {resumeUrl && (
                <ClientPortalLink
                  href={resumeUrl}
                  className="inline-flex items-center rounded-lg border border-primary/20 bg-white px-3.5 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {actionLabel}
                </ClientPortalLink>
              )}
              {!isFinishing && (
                <button
                  type="button"
                  onClick={(event) => onDelete(event.currentTarget)}
                  disabled={deleteInteractionDisabled}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-sm font-bold text-muted transition-colors hover:bg-surface hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {copy.delete}
                </button>
              )}
            </div>

            {error && (
              <p
                aria-live="polite"
                className="mt-3 text-sm font-medium text-red-600"
              >
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
