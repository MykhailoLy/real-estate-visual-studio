"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Clock3, FileText, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  getSavedDraftTitle,
  resolveSavedDraftServiceName,
} from "@/lib/order-drafts/saved-drafts";
import type { OrderDraftSummary } from "@/lib/order-drafts/types";

type LoadState = "loading" | "success" | "error";
type DeleteRefreshResult = "refreshed" | "failed" | "redirected" | "aborted";

interface DraftsPageCopy {
  heading: string;
  helper: string;
  badge: string;
  updated: string;
  resume: string;
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
    updated: "Updated",
    resume: "Resume",
    delete: "Delete",
    confirmTitle: "Delete this draft?",
    confirmMessage:
      "This action removes the saved draft. It does not affect submitted orders.",
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
    deleted: "Draft deleted.",
    deleteFailed: "Draft could not be deleted. Try again.",
    conflict:
      "This draft changed in another tab. The list was refreshed. Review it and try again.",
    unavailable: "This draft is no longer available. The list was refreshed.",
  },
  es: {
    heading: "Borradores",
    helper: "Continúa editando o elimina los pedidos guardados que ya no necesites.",
    badge: "Borrador",
    updated: "Actualizado",
    resume: "Continuar",
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
  const mountedRef = useRef(true);
  const activeDeleteControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeDeleteControllerRef.current?.abort();
    };
  }, []);

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

  const beginDelete = (draftId: string) => {
    if (activeDeleteControllerRef.current) return;
    setConfirmDraftId(draftId);
    setCardErrors({});
    setStatusMessage("");
  };

  const cancelDelete = () => {
    setConfirmDraftId(null);
    setStatusMessage("");
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
        setStatusMessage(copy.deleted);
        return;
      }

      if (result.code === "unauthenticated") {
        router.push(LOGIN_REDIRECT);
        return;
      }

      if (shouldRefreshDraftListAfterDeleteError(result.code)) {
        setConfirmDraftId(null);
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
          <Link
            href="/dashboard/orders/new"
            className="mt-5 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {copy.startOrder}
          </Link>
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
                confirming={confirmDraftId === draft.id}
                deleting={deletingDraftId === draft.id}
                deleteInteractionDisabled={deletingDraftId !== null}
                error={cardErrors[draft.id] ?? ""}
                onDelete={() => beginDelete(draft.id)}
                onCancel={cancelDelete}
                onConfirm={() => void confirmDelete(draft)}
              />
            </li>
          ))}
        </ul>
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
  confirming,
  deleting,
  deleteInteractionDisabled,
  error,
  onDelete,
  onCancel,
  onConfirm,
}: {
  draft: OrderDraftSummary;
  copy: DraftsPageCopy;
  language: SiteLanguage;
  confirming: boolean;
  deleting: boolean;
  deleteInteractionDisabled: boolean;
  error: string;
  onDelete: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const resumeUrl = buildSavedDraftResumeUrl(draft.route, draft.id);
  const title = getSavedDraftTitle(draft.title, copy.untitled);
  const serviceName = resolveSavedDraftServiceName(draft);
  const updatedAt = formatSavedDraftUpdatedAt(
    draft.updatedAt,
    language,
    copy.updatedUnavailable,
  );

  return (
    <article className="flex w-full flex-col rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-2.5 py-1 text-[11px] font-bold uppercase text-secondary-dark">
          <FileText className="h-3.5 w-3.5" aria-hidden />
          {copy.badge}
        </span>
      </div>

      <h2 className="line-clamp-2 text-base font-bold text-foreground">
        {title}
      </h2>
      <p className="mt-1 text-sm font-medium text-primary">{serviceName}</p>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <Clock3 className="h-3.5 w-3.5" aria-hidden />
        <span className="font-semibold">{copy.updated}</span>
        <span>{updatedAt}</span>
      </p>

      <div className="mt-auto pt-4">
        {confirming ? (
          <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-3">
            <p className="text-sm font-bold text-primary">{copy.confirmTitle}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {copy.confirmMessage}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={deleting}
                className="inline-flex items-center rounded-lg border border-border bg-white px-3 py-2 text-sm font-bold text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {deleting ? copy.deleting : copy.confirmDelete}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {resumeUrl && (
              <Link
                href={resumeUrl}
                className="inline-flex items-center rounded-lg border border-primary/20 bg-white px-3.5 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {copy.resume}
              </Link>
            )}
            <button
              type="button"
              onClick={onDelete}
              disabled={deleteInteractionDisabled}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-sm font-bold text-muted transition-colors hover:bg-surface hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {copy.delete}
            </button>
          </div>
        )}

        {error && (
          <p aria-live="polite" className="mt-3 text-sm font-medium text-red-600">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
