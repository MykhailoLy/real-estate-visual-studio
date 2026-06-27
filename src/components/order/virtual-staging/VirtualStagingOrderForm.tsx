"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, RotateCcw, Save } from "lucide-react";
import OrderLayout from "@/components/order/OrderLayout";
import OrderSummary, { type SummaryItem } from "@/components/order/OrderSummary";
import OrderTermsBlock, {
  type OrderTermsData,
  emptyOrderTerms,
} from "@/components/order/OrderTermsBlock";
import Confirmation from "@/components/order/Confirmation";
import OrderJobTitleField, {
  isJobTitleValid,
} from "@/components/order/OrderJobTitleField";
import StagingItemCard, {
  type StagingItemData,
  emptyStagingItem,
} from "@/components/order/virtual-staging/StagingItemCard";
import { redirectOnOrderAuthError } from "@/components/order/order-redirect";
import {
  RegionalCentsText,
  useDisplayRegion,
} from "@/components/pricing/currency-client";
import { submitOrder } from "@/lib/submit-order";
import Container from "@/components/layout/Container";
import { getCatalogPrice } from "@/lib/pricing/catalog";
import { currencyForRegion } from "@/lib/currency";
import {
  LANGUAGE_CHANGE_EVENT,
  getCurrentLanguage,
  readStoredLanguage,
  type SiteLanguage,
} from "@/components/layout/Header";
import {
  createOrderDraft,
  getOrderDraft,
  isOrderDraftVersionConflict,
  updateOrderDraft,
} from "@/lib/order-drafts/client";
import { UuidSchema } from "@/lib/order-drafts/schema";
import {
  buildVirtualStagingDraftFingerprint,
  buildVirtualStagingCreateDraftInput,
  buildVirtualStagingUpdateDraftInput,
  hasMeaningfulVirtualStagingDraftChange,
  isVirtualStagingFinalSubmissionReady,
  resetVirtualStagingDraftIdentity,
  resolveVirtualStagingDraftRegion,
  shouldApplyVirtualStagingSaveResult,
  shouldShowVirtualStagingResumedFileWarning,
  shouldSkipDuplicateVirtualStagingSave,
  shouldSkipFailedVirtualStagingAutosave,
  validateVirtualStagingDraftForResume,
  type VirtualStagingAutosaveStatus,
} from "@/lib/order-drafts/virtual-staging";

// ============================================================
// Virtual Staging order form (authenticated dashboard).
//
// Identity (name/email/phone/company) is NOT collected here — it
// comes from the verified Supabase session + client_profiles on the
// server. `clientEmail` is used only for the confirmation screen;
// `orderRoute` is where we send the client back to after login /
// profile completion if the session/profile is not ready.
// ============================================================

interface VirtualStagingOrderFormProps {
  clientEmail: string;
  orderRoute: string;
}

type DraftCopy = Record<VirtualStagingAutosaveStatus, string> & {
  draft: string;
  saveAndExit: string;
  restoring: string;
  draftNotFound: string;
  draftCouldNotRestore: string;
  defaultRestoreError: string;
  startNew: string;
  retry: string;
  reloadLatest: string;
  keepEditing: string;
  resumedFileWarning: string;
  conflictMessage: string;
  keepEditingActive: string;
  versionNotReady: string;
  signInAgain: string;
  restoreFailed: string;
  savedOriginalFile: (filename: string) => string;
  savedReferenceFile: (filename: string) => string;
};

const DRAFT_COPY: Record<SiteLanguage, DraftCopy> = {
  en: {
    draft: "Draft",
    not_saved: "Not saved yet",
    saving: "Saving…",
    saved: "Saved",
    save_failed: "Save failed",
    conflict: "Changed in another tab",
    saveAndExit: "Save and exit",
    restoring: "Restoring your draft...",
    draftNotFound: "Draft not found",
    draftCouldNotRestore: "Draft could not be restored",
    defaultRestoreError:
      "This draft may have expired, been deleted, or belongs to another account.",
    startNew: "Start a new Virtual Staging order",
    retry: "Retry",
    reloadLatest: "Reload latest draft",
    keepEditing: "Keep editing",
    resumedFileWarning:
      "Your draft settings were restored. Uploaded images are not saved yet, so please select the required files again.",
    conflictMessage:
      "This draft changed in another tab. Reload latest draft or keep editing without autosave.",
    keepEditingActive:
      "Keep editing is active. Autosave is paused until you reload the latest draft.",
    versionNotReady: "Draft version is not ready yet.",
    signInAgain: "Please sign in again to restore this draft.",
    restoreFailed: "Draft could not be restored. Please try again.",
    savedOriginalFile: (filename: string) =>
      `Saved draft file: ${filename}. Please select it again to submit.`,
    savedReferenceFile: (filename: string) =>
      `Saved draft reference: ${filename}. Select it again if it is still needed.`,
  },
  es: {
    draft: "Borrador",
    not_saved: "Aún no guardado",
    saving: "Guardando...",
    saved: "Guardado",
    save_failed: "Error al guardar",
    conflict: "Cambiado en otra pestaña",
    saveAndExit: "Guardar y salir",
    restoring: "Restaurando tu borrador…",
    draftNotFound: "Borrador no encontrado",
    draftCouldNotRestore: "No se pudo restaurar el borrador",
    defaultRestoreError:
      "Este borrador puede haber caducado, haberse eliminado o pertenecer a otra cuenta.",
    startNew: "Empezar un nuevo pedido de Virtual Staging",
    retry: "Reintentar",
    reloadLatest: "Recargar el borrador más reciente",
    keepEditing: "Seguir editando",
    resumedFileWarning:
      "Se restauró la configuración del borrador. Las imágenes subidas todavía no se guardan, así que vuelve a seleccionar los archivos necesarios.",
    conflictMessage:
      "Este borrador cambió en otra pestaña. Recarga el borrador más reciente o sigue editando sin autoguardado.",
    keepEditingActive:
      "Seguir editando está activo. El autoguardado está pausado hasta que recargues el borrador más reciente.",
    versionNotReady: "La versión del borrador todavía no está lista.",
    signInAgain: "Inicia sesión otra vez para restaurar este borrador.",
    restoreFailed: "No se pudo restaurar el borrador. Inténtalo de nuevo.",
    savedOriginalFile: (filename: string) =>
      `Archivo guardado en el borrador: ${filename}. Selecciónalo otra vez para enviar.`,
    savedReferenceFile: (filename: string) =>
      `Referencia guardada en el borrador: ${filename}. Selecciónala otra vez si todavía la necesitas.`,
  },
};

export default function VirtualStagingOrderForm({
  clientEmail,
  orderRoute,
}: VirtualStagingOrderFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [region, setRegion] = useDisplayRegion();
  const currency = currencyForRegion(region);
  const [savedLanguage, setSavedLanguage] = useState<SiteLanguage | null>(null);
  const language = getCurrentLanguage(pathname, savedLanguage);
  const copy = DRAFT_COPY[language];
  const [items, setItems] = useState<StagingItemData[]>([emptyStagingItem()]);
  const [jobTitle, setJobTitle] = useState("");
  const [orderTerms, setOrderTerms] = useState<OrderTermsData>(emptyOrderTerms);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [draftId, setDraftId] = useState<string | null>(() => {
    const value = searchParams.get("draft");
    return value && UuidSchema.safeParse(value).success ? value : null;
  });
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] =
    useState<VirtualStagingAutosaveStatus>("not_saved");
  const [draftError, setDraftError] = useState("");
  const [resumeState, setResumeState] = useState<
    "idle" | "loading" | "ready" | "not_found" | "unsupported" | "error"
  >(() => (searchParams.get("draft") ? "loading" : "ready"));
  const [conflictMessage, setConflictMessage] = useState("");

  const draftIdRef = useRef(draftId);
  const draftVersionRef = useRef(draftVersion);
  const savedFingerprintRef = useRef<string | null>(null);
  const failedAutosaveFingerprintRef = useRef<string | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const isRestoringRef = useRef(resumeState === "loading");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSessionRef = useRef(0);

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
    draftIdRef.current = draftId;
  }, [draftId]);

  useEffect(() => {
    draftVersionRef.current = draftVersion;
  }, [draftVersion]);

  useEffect(() => {
    isRestoringRef.current = resumeState === "loading";
  }, [resumeState]);

  const handleItemChange = (index: number, data: StagingItemData) => {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  };

  const handleAddItem = () => setItems((prev) => [...prev, emptyStagingItem()]);

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const draftSource = useMemo(
    () => ({
      jobTitle,
      items,
      orderTerms,
      currency,
      region,
    }),
    [currency, items, jobTitle, orderTerms, region],
  );

  const hasMeaningfulDraft = useMemo(
    () => hasMeaningfulVirtualStagingDraftChange(draftSource),
    [draftSource],
  );

  const showResumedFileNotice = useMemo(
    () => shouldShowVirtualStagingResumedFileWarning(items),
    [items],
  );

  const replaceDraftUrl = useCallback(
    (nextSearch: string) => {
      const suffix = nextSearch ? `?${nextSearch}` : "";
      router.replace(`${pathname}${suffix}`, { scroll: false });
    },
    [pathname, router],
  );

  const setDraftQueryParam = useCallback(
    (nextDraftId: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("draft", nextDraftId);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const startNewVirtualStagingOrder = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    draftSessionRef.current += 1;
    saveChainRef.current = Promise.resolve();
    const reset = resetVirtualStagingDraftIdentity(searchParams.toString());

    setItems([emptyStagingItem()]);
    setJobTitle("");
    setOrderTerms(emptyOrderTerms);
    setSubmitted(false);
    setOrderNumber("");
    setConfirmationEmailSent(false);
    setSubmitError("");
    setDraftError("");
    setConflictMessage(reset.identity.conflictMessage);
    setDraftId(reset.identity.draftId);
    setDraftVersion(reset.identity.draftVersion);
    draftIdRef.current = reset.identity.draftId;
    draftVersionRef.current = reset.identity.draftVersion;
    savedFingerprintRef.current = reset.identity.savedFingerprint;
    failedAutosaveFingerprintRef.current =
      reset.identity.failedAutosaveFingerprint;
    setSaveStatus(reset.identity.saveStatus);
    setResumeState(reset.identity.resumeState);
    isRestoringRef.current = false;
    replaceDraftUrl(reset.nextSearch);
  }, [replaceDraftUrl, searchParams]);

  const saveDraftNow = useCallback(
    (options: { force?: boolean } = {}) => {
      const sessionAtEnqueue = draftSessionRef.current;

      const run = async (): Promise<boolean> => {
        if (
          !shouldApplyVirtualStagingSaveResult(
            sessionAtEnqueue,
            draftSessionRef.current,
          )
        ) {
          return false;
        }
        if (isRestoringRef.current || resumeState === "loading") return false;
        if (!options.force && !hasMeaningfulDraft) return true;
        if (saveStatus === "conflict") return false;

        const fingerprint = buildVirtualStagingDraftFingerprint(draftSource);
        if (
          shouldSkipFailedVirtualStagingAutosave(
            failedAutosaveFingerprintRef.current,
            fingerprint,
            options.force === true,
          )
        ) {
          return false;
        }
        if (
          !options.force &&
          shouldSkipDuplicateVirtualStagingSave(
            savedFingerprintRef.current,
            fingerprint,
          )
        ) {
          setSaveStatus(draftIdRef.current ? "saved" : "not_saved");
          return true;
        }

        setSaveStatus("saving");
        setDraftError("");

        const currentDraftId = draftIdRef.current;
        if (!currentDraftId) {
          const result = await createOrderDraft(
            buildVirtualStagingCreateDraftInput(draftSource),
          );
          if (
            !shouldApplyVirtualStagingSaveResult(
              sessionAtEnqueue,
              draftSessionRef.current,
            )
          ) {
            return false;
          }
          if (!result.ok) {
            setSaveStatus("save_failed");
            setDraftError(result.message);
            failedAutosaveFingerprintRef.current = fingerprint;
            return false;
          }
          draftIdRef.current = result.data.id;
          draftVersionRef.current = result.data.version;
          setDraftId(result.data.id);
          setDraftVersion(result.data.version);
          savedFingerprintRef.current = fingerprint;
          failedAutosaveFingerprintRef.current = null;
          setDraftQueryParam(result.data.id);
          setSaveStatus("saved");
          return true;
        }

        const expectedVersion = draftVersionRef.current;
        if (!expectedVersion) {
          setSaveStatus("save_failed");
          setDraftError(copy.versionNotReady);
          return false;
        }

        const result = await updateOrderDraft(
          currentDraftId,
          buildVirtualStagingUpdateDraftInput(draftSource, expectedVersion),
        );
        if (
          !shouldApplyVirtualStagingSaveResult(
            sessionAtEnqueue,
            draftSessionRef.current,
          )
        ) {
          return false;
        }
        if (!result.ok) {
          if (isOrderDraftVersionConflict(result)) {
            setSaveStatus("conflict");
            setConflictMessage(copy.conflictMessage);
            return false;
          }
          setSaveStatus("save_failed");
          setDraftError(result.message);
          failedAutosaveFingerprintRef.current = fingerprint;
          return false;
        }

        draftVersionRef.current = result.data.version;
        setDraftVersion(result.data.version);
        savedFingerprintRef.current = fingerprint;
        failedAutosaveFingerprintRef.current = null;
        setSaveStatus("saved");
        return true;
      };

      const savePromise = saveChainRef.current.then(run, run);
      saveChainRef.current = savePromise.then(
        () => undefined,
        () => undefined,
      );
      return savePromise;
    },
    [
      draftSource,
      hasMeaningfulDraft,
      resumeState,
      saveStatus,
      setDraftQueryParam,
      copy,
    ],
  );

  useEffect(() => {
    const requestedDraftId = searchParams.get("draft");
    if (!requestedDraftId) {
      return;
    }
    if (!UuidSchema.safeParse(requestedDraftId).success) {
      window.queueMicrotask(() => setResumeState("not_found"));
      return;
    }
    if (
      requestedDraftId === draftIdRef.current &&
      savedFingerprintRef.current !== null &&
      !isRestoringRef.current
    ) {
      return;
    }

    const controller = new AbortController();
    const sessionAtStart = draftSessionRef.current;
    window.queueMicrotask(() => {
      setResumeState("loading");
      setDraftError("");
    });
    isRestoringRef.current = true;

    getOrderDraft(requestedDraftId, controller.signal)
      .then((result) => {
        if (
          !shouldApplyVirtualStagingSaveResult(
            sessionAtStart,
            draftSessionRef.current,
          )
        ) {
          return;
        }
        if (!result.ok) {
          if (result.status === 401) {
            setResumeState("error");
            setDraftError(copy.signInAgain);
            return;
          }
          if (result.status === 404) {
            setResumeState("not_found");
            return;
          }
          setResumeState("error");
          setDraftError(result.message);
          return;
        }

        const resume = validateVirtualStagingDraftForResume(result.data);
        if (!resume.ok) {
          setResumeState("unsupported");
          setDraftError(resume.message);
          return;
        }

        setItems(resume.form.items);
        setJobTitle(resume.form.jobTitle);
        setOrderTerms(resume.form.orderTerms);
        const restoredRegion = resolveVirtualStagingDraftRegion(result.data);
        const restoredCurrency = currencyForRegion(restoredRegion);
        setRegion(restoredRegion);
        setDraftId(result.data.id);
        setDraftVersion(resume.version);
        draftIdRef.current = result.data.id;
        draftVersionRef.current = resume.version;
        savedFingerprintRef.current = buildVirtualStagingDraftFingerprint({
          jobTitle: resume.form.jobTitle,
          items: resume.form.items,
          orderTerms: resume.form.orderTerms,
          currency: restoredCurrency,
          region: restoredRegion,
        });
        failedAutosaveFingerprintRef.current = null;
        setSaveStatus("saved");
        setResumeState("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResumeState("error");
        setDraftError(copy.restoreFailed);
      })
      .finally(() => {
        isRestoringRef.current = false;
      });

    return () => controller.abort();
  }, [copy, searchParams, setRegion]);

  useEffect(() => {
    if (resumeState !== "ready" || !hasMeaningfulDraft || saveStatus === "conflict") {
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void saveDraftNow();
    }, 1800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draftSource, hasMeaningfulDraft, resumeState, saveDraftNow, saveStatus]);

  const handleSaveAndExit = async () => {
    const saved = await saveDraftNow({ force: true });
    if (saved) router.push("/dashboard/orders/new");
  };

  const handleReloadLatestDraft = async () => {
    const currentDraftId = draftIdRef.current;
    if (!currentDraftId) return;
    setResumeState("loading");
    setConflictMessage("");
    const result = await getOrderDraft(currentDraftId);
    if (!result.ok) {
      setResumeState(result.status === 404 ? "not_found" : "error");
      setDraftError(result.message);
      return;
    }
    const resume = validateVirtualStagingDraftForResume(result.data);
    if (!resume.ok) {
      setResumeState("unsupported");
      setDraftError(resume.message);
      return;
    }
    setItems(resume.form.items);
    setJobTitle(resume.form.jobTitle);
    setOrderTerms(resume.form.orderTerms);
    const restoredRegion = resolveVirtualStagingDraftRegion(result.data);
    const restoredCurrency = currencyForRegion(restoredRegion);
    setRegion(restoredRegion);
    setDraftVersion(resume.version);
    draftVersionRef.current = resume.version;
    savedFingerprintRef.current = buildVirtualStagingDraftFingerprint({
      jobTitle: resume.form.jobTitle,
      items: resume.form.items,
      orderTerms: resume.form.orderTerms,
      currency: restoredCurrency,
      region: restoredRegion,
    });
    failedAutosaveFingerprintRef.current = null;
    setSaveStatus("saved");
    setResumeState("ready");
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");

    const itemsMetadata = items.map((item) => ({
      roomName: item.roomName,
      furnitureStyle: item.furnitureStyle,
      fileSizeLimit: item.fileSizeLimit,
      disclaimerText: item.disclaimerText,
      referenceLink: item.referenceLink,
      additionalInfo: item.additionalInfo,
      selectedAddons: item.selectedAddons,
    }));

    const files = items.map((item) => ({
      file: item.file,
      referenceFile: item.referenceFile,
    }));

    const result = await submitOrder(
      "virtual-staging",
      itemsMetadata,
      files,
      orderTerms,
      jobTitle
    );

    if (result.success && result.orderNumber) {
      setOrderNumber(result.orderNumber);
      setConfirmationEmailSent(result.confirmationEmailSent === true);
      setSubmitted(true);
      setIsSubmitting(false);
      return;
    }

    // Auth/profile errors navigate away (preserving this order route).
    if (redirectOnOrderAuthError(result, orderRoute)) return;

    setIsSubmitting(false);
    setSubmitError(result.error || "Submission failed. Please try again.");
  };

  const handleNewOrder = startNewVirtualStagingOrder;

  // --- Validation ---
  const allItemsValid = items.every(
    (item) => item.file !== null && item.roomName !== "" && item.furnitureStyle !== ""
  );
  const missingResumedFiles = items.some(
    (item) => item.needsOriginalFileReselection && item.file === null,
  );
  const termsAccepted = orderTerms.accepted;
  const canSubmit =
    items.length > 0 &&
    allItemsValid &&
    !missingResumedFiles &&
    isVirtualStagingFinalSubmissionReady(items) &&
    termsAccepted &&
    isJobTitleValid(jobTitle);

  // --- Summary ---
  const summaryItems: SummaryItem[] = items.map((item, i) => ({
    label: item.roomName || `Image #${i + 1}`,
  }));

  if (submitted) {
    return (
      <section className="py-16 bg-surface min-h-screen">
        <Container>
          <Confirmation
            orderNumber={orderNumber}
            email={clientEmail}
            jobTitle={jobTitle}
            confirmationEmailSent={confirmationEmailSent}
            onNewOrder={handleNewOrder}
          />
        </Container>
      </section>
    );
  }

  if (resumeState === "loading") {
    return (
      <section className="py-16 bg-surface min-h-screen">
        <Container>
          <div className="rounded-xl border border-border bg-white p-6 text-sm text-muted shadow-sm">
            {copy.restoring}
          </div>
        </Container>
      </section>
    );
  }

  if (resumeState === "not_found" || resumeState === "unsupported" || resumeState === "error") {
    return (
      <section className="py-16 bg-surface min-h-screen">
        <Container>
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-foreground">
              {resumeState === "not_found"
                ? copy.draftNotFound
                : copy.draftCouldNotRestore}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {draftError ||
                copy.defaultRestoreError}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={startNewVirtualStagingOrder}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light"
              >
                {copy.startNew}
              </button>
              {resumeState === "error" && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface"
                >
                  {copy.retry}
                </button>
              )}
            </div>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <OrderLayout
      title="Virtual Staging"
      subtitle={
        <>
          Upload your empty room photos and choose a furniture style.{" "}
          <RegionalCentsText
            cents={getCatalogPrice("virtual-staging", currency)}
          />{" "}
          per image + optional add-ons.
        </>
      }
      sidebar={
        <OrderSummary
          serviceName="Virtual Staging"
          items={summaryItems}
          pricingInput={{
            serviceType: "virtual-staging",
            items: items.map((item) => ({
              selectedAddons: item.selectedAddons,
            })),
          }}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          canSubmit={canSubmit}
        />
      }
    >
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            {copy.draft}
          </p>
          <p className="text-sm font-medium text-foreground">
            {copy[saveStatus]}
          </p>
          {draftError && (
            <p className="mt-1 text-xs text-red-700">{draftError}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSaveAndExit}
          disabled={saveStatus === "saving"}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          <Save className="h-4 w-4" />
          {copy.saveAndExit}
        </button>
      </div>

      {showResumedFileNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {copy.resumedFileWarning}
        </div>
      )}

      {saveStatus === "conflict" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p>{conflictMessage}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleReloadLatestDraft}
              className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {copy.reloadLatest}
            </button>
            <button
              type="button"
              onClick={() =>
                setConflictMessage(
                  copy.keepEditingActive,
                )
              }
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50"
            >
              {copy.keepEditing}
            </button>
          </div>
        </div>
      )}

      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          {submitError}
        </div>
      )}

      <OrderJobTitleField value={jobTitle} onChange={setJobTitle} />

      <div className="space-y-5">
        {items.map((item, index) => (
          <StagingItemCard
            key={item.clientItemId}
            index={index}
            data={item}
            onChange={(data) => handleItemChange(index, data)}
            onRemove={() => handleRemoveItem(index)}
            canRemove={items.length > 1}
            draftCopy={{
              savedOriginalFile: copy.savedOriginalFile,
              savedReferenceFile: copy.savedReferenceFile,
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddItem}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted hover:text-primary hover:border-primary/40 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Another Image
      </button>

      <OrderTermsBlock data={orderTerms} onChange={setOrderTerms} />
    </OrderLayout>
  );
}
