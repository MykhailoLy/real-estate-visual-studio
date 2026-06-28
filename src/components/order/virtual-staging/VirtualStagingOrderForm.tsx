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
import {
  completeOrderDraftFileUpload,
  deleteOrderDraftFile,
  listOrderDraftFiles,
  prepareOrderDraftFileUpload,
  uploadPreparedOrderDraftFile,
} from "@/lib/order-drafts/files-client";
import type { OrderDraftUploadedFileSummary } from "@/lib/order-drafts/files";
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
  updateOriginalFileDraftMetadata,
  updateReferenceFileDraftMetadata,
  validateVirtualStagingDraftForResume,
  type VirtualStagingAutosaveStatus,
  type VirtualStagingFormDraftSource,
} from "@/lib/order-drafts/virtual-staging";
import {
  buildVirtualStagingDraftFileSlotKey,
  clearVirtualStagingDraftFileOperation,
  collectVirtualStagingUploadedFileIdsForItem,
  getVirtualStagingUploadedFileForSlot,
  hasActiveVirtualStagingDraftFileOperation,
  indexVirtualStagingUploadedFilesBySlot,
  isVirtualStagingDraftFileSlotOperationActive,
  nextVirtualStagingDraftFileOperationGeneration,
  removeVirtualStagingUploadedFileSummary,
  replaceVirtualStagingUploadedFileSummary,
  resetVirtualStagingDraftFileState,
  shouldApplyVirtualStagingDraftFileOperationResult,
  type VirtualStagingDraftFileOperation,
  type VirtualStagingDraftFileOperationMap,
  type VirtualStagingDraftFileOperationSession,
  type VirtualStagingDraftFileSlotKind,
} from "@/lib/order-drafts/virtual-staging-files";

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
  savedInDraft: string;
  filesCouldNotRestore: string;
  retryFiles: string;
  retryUpload: string;
  replaceFile: string;
  removeSavedFile: string;
  fileSavingDraft: string;
  fileUploading: string;
  fileDeleting: string;
  fileOperationFailed: string;
  previousSavedFileAvailable: string;
  itemFilesCouldNotDelete: string;
};

type DraftSaveOutcome =
  | { ok: true; draftId: string; version: number }
  | { ok: false };

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
      "Your images are saved with this draft. To submit this restored draft, select the required original files again.",
    conflictMessage:
      "This draft changed in another tab. Reload latest draft or keep editing without autosave.",
    keepEditingActive:
      "Keep editing is active. Autosave is paused until you reload the latest draft.",
    versionNotReady: "Draft version is not ready yet.",
    signInAgain: "Please sign in again to restore this draft.",
    restoreFailed: "Draft could not be restored. Please try again.",
    savedOriginalFile: (filename: string) =>
      `Saved with draft: ${filename}. Select it again to submit.`,
    savedReferenceFile: (filename: string) =>
      `Saved with draft: ${filename}. Select it again if it is still needed.`,
    savedInDraft: "Saved in draft",
    filesCouldNotRestore:
      "Saved draft files could not be loaded. You can keep editing and retry file restore.",
    retryFiles: "Retry files",
    retryUpload: "Retry upload",
    replaceFile: "Replace",
    removeSavedFile: "Remove file",
    fileSavingDraft: "Saving draft...",
    fileUploading: "Uploading...",
    fileDeleting: "Deleting...",
    fileOperationFailed: "Could not save this file with the draft.",
    previousSavedFileAvailable: "The previous saved file is still available.",
    itemFilesCouldNotDelete:
      "Saved files for this image could not be deleted. The image was kept in the draft.",
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
      "Tus imágenes están guardadas con este borrador. Para enviar este borrador restaurado, vuelve a seleccionar los archivos originales requeridos.",
    conflictMessage:
      "Este borrador cambió en otra pestaña. Recarga el borrador más reciente o sigue editando sin autoguardado.",
    keepEditingActive:
      "Seguir editando está activo. El autoguardado está pausado hasta que recargues el borrador más reciente.",
    versionNotReady: "La versión del borrador todavía no está lista.",
    signInAgain: "Inicia sesión otra vez para restaurar este borrador.",
    restoreFailed: "No se pudo restaurar el borrador. Inténtalo de nuevo.",
    savedOriginalFile: (filename: string) =>
      `Guardado con el borrador: ${filename}. Selecciónalo otra vez para enviar.`,
    savedReferenceFile: (filename: string) =>
      `Guardado con el borrador: ${filename}. Selecciónalo otra vez si todavía lo necesitas.`,
    savedInDraft: "Guardado en el borrador",
    filesCouldNotRestore:
      "No se pudieron cargar los archivos guardados del borrador. Puedes seguir editando y reintentar la restauración de archivos.",
    retryFiles: "Reintentar archivos",
    retryUpload: "Reintentar subida",
    replaceFile: "Reemplazar",
    removeSavedFile: "Eliminar archivo",
    fileSavingDraft: "Guardando borrador...",
    fileUploading: "Subiendo...",
    fileDeleting: "Eliminando...",
    fileOperationFailed: "No se pudo guardar este archivo con el borrador.",
    previousSavedFileAvailable:
      "El archivo guardado anterior sigue disponible.",
    itemFilesCouldNotDelete:
      "No se pudieron eliminar los archivos guardados de esta imagen. La imagen se mantuvo en el borrador.",
  },
};

export default function VirtualStagingOrderForm({
  clientEmail,
  orderRoute,
}: VirtualStagingOrderFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedDraftId = searchParams.get("draft");
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
    return requestedDraftId && UuidSchema.safeParse(requestedDraftId).success
      ? requestedDraftId
      : null;
  });
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] =
    useState<VirtualStagingAutosaveStatus>("not_saved");
  const [draftError, setDraftError] = useState("");
  const [resumeState, setResumeState] = useState<
    "idle" | "loading" | "ready" | "not_found" | "unsupported" | "error"
  >(() => (requestedDraftId ? "loading" : "ready"));
  const [conflictMessage, setConflictMessage] = useState("");
  const [uploadedDraftFiles, setUploadedDraftFiles] = useState<
    OrderDraftUploadedFileSummary[]
  >([]);
  const [draftFileOperations, setDraftFileOperations] =
    useState<VirtualStagingDraftFileOperationMap>({});
  const [draftFilesWarning, setDraftFilesWarning] = useState("");

  const draftIdRef = useRef(draftId);
  const draftVersionRef = useRef(draftVersion);
  const itemsRef = useRef(items);
  const uploadedDraftFilesRef = useRef(uploadedDraftFiles);
  const draftFileOperationsRef = useRef(draftFileOperations);
  const mountedRef = useRef(false);
  const savedFingerprintRef = useRef<string | null>(null);
  const failedAutosaveFingerprintRef = useRef<string | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const isRestoringRef = useRef(resumeState === "loading");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSessionRef = useRef(0);
  const draftFileAbortControllersRef = useRef<Map<string, AbortController>>(
    new Map(),
  );

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
    mountedRef.current = true;
    const abortControllers = draftFileAbortControllersRef.current;
    return () => {
      mountedRef.current = false;
      for (const controller of abortControllers.values()) {
        controller.abort();
      }
      abortControllers.clear();
    };
  }, []);

  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);

  useEffect(() => {
    draftVersionRef.current = draftVersion;
  }, [draftVersion]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    uploadedDraftFilesRef.current = uploadedDraftFiles;
  }, [uploadedDraftFiles]);

  useEffect(() => {
    draftFileOperationsRef.current = draftFileOperations;
  }, [draftFileOperations]);

  useEffect(() => {
    isRestoringRef.current = resumeState === "loading";
  }, [resumeState]);

  const handleItemChange = (index: number, data: StagingItemData) => {
    setItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  };

  const handleAddItem = () => setItems((prev) => [...prev, emptyStagingItem()]);

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

  const buildDraftSourceSnapshot = useCallback(
    (snapshotItems: StagingItemData[] = itemsRef.current):
      VirtualStagingFormDraftSource => ({
        jobTitle,
        items: snapshotItems,
        orderTerms,
        currency,
        region,
      }),
    [currency, jobTitle, orderTerms, region],
  );

  const setDraftFileOperation = useCallback(
    (slotKey: string, operation: VirtualStagingDraftFileOperation) => {
      setDraftFileOperations((prev) => {
        const next = { ...prev, [slotKey]: operation };
        draftFileOperationsRef.current = next;
        return next;
      });
    },
    [],
  );

  const clearDraftFileOperation = useCallback(
    (slotKey: string, generation: number) => {
      setDraftFileOperations((prev) => {
        const next = clearVirtualStagingDraftFileOperation(
          prev,
          slotKey,
          generation,
        );
        draftFileOperationsRef.current = next;
        return next;
      });
    },
    [],
  );

  const shouldApplyDraftFileOperation = useCallback(
    (
      slotKey: string,
      session: VirtualStagingDraftFileOperationSession,
    ): boolean => {
      return (
        mountedRef.current &&
        shouldApplyVirtualStagingDraftFileOperationResult(
          session,
          draftSessionRef.current,
          draftFileOperationsRef.current[slotKey]?.generation,
        )
      );
    },
    [],
  );

  const refreshUploadedDraftFiles = useCallback(
    async (
      currentDraftId: string,
      sessionAtStart: number,
      signal?: AbortSignal,
    ): Promise<boolean> => {
      const result = await listOrderDraftFiles(currentDraftId, signal);
      if (
        !mountedRef.current ||
        !shouldApplyVirtualStagingSaveResult(
          sessionAtStart,
          draftSessionRef.current,
        )
      ) {
        return false;
      }
      if (!result.ok) {
        setDraftFilesWarning(copy.filesCouldNotRestore);
        return false;
      }

      setDraftFilesWarning("");
      setUploadedDraftFiles(result.data);
      uploadedDraftFilesRef.current = result.data;
      return true;
    },
    [copy.filesCouldNotRestore],
  );

  const hasMeaningfulDraft = useMemo(
    () => hasMeaningfulVirtualStagingDraftChange(draftSource),
    [draftSource],
  );

  const showResumedFileNotice = useMemo(
    () => shouldShowVirtualStagingResumedFileWarning(items),
    [items],
  );

  const uploadedFilesBySlot = useMemo(
    () =>
      indexVirtualStagingUploadedFilesBySlot(
        uploadedDraftFiles,
        items.map((item) => item.clientItemId),
      ),
    [items, uploadedDraftFiles],
  );

  const hasActiveDraftFileOperation = useMemo(
    () => hasActiveVirtualStagingDraftFileOperation(draftFileOperations),
    [draftFileOperations],
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
    for (const controller of draftFileAbortControllersRef.current.values()) {
      controller.abort();
    }
    draftFileAbortControllersRef.current.clear();
    saveChainRef.current = Promise.resolve();
    const reset = resetVirtualStagingDraftIdentity(searchParams.toString());
    const fileReset = resetVirtualStagingDraftFileState();

    setItems([emptyStagingItem()]);
    setUploadedDraftFiles(fileReset.uploadedFiles);
    uploadedDraftFilesRef.current = fileReset.uploadedFiles;
    setDraftFileOperations(fileReset.operations);
    draftFileOperationsRef.current = fileReset.operations;
    setDraftFilesWarning(fileReset.warning);
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

  const enqueueDraftSave = useCallback(
    (
      sourceSnapshot: VirtualStagingFormDraftSource,
      options: { force?: boolean } = {},
    ): Promise<DraftSaveOutcome> => {
      const sessionAtEnqueue = draftSessionRef.current;

      const run = async (): Promise<DraftSaveOutcome> => {
        if (
          !shouldApplyVirtualStagingSaveResult(
            sessionAtEnqueue,
            draftSessionRef.current,
          )
        ) {
          return { ok: false };
        }
        if (isRestoringRef.current || resumeState === "loading") {
          return { ok: false };
        }
        if (
          !options.force &&
          !hasMeaningfulVirtualStagingDraftChange(sourceSnapshot)
        ) {
          const currentDraftId = draftIdRef.current;
          const currentVersion = draftVersionRef.current;
          return currentDraftId && currentVersion
            ? { ok: true, draftId: currentDraftId, version: currentVersion }
            : { ok: false };
        }
        if (saveStatus === "conflict") return { ok: false };

        const fingerprint = buildVirtualStagingDraftFingerprint(sourceSnapshot);
        if (
          shouldSkipFailedVirtualStagingAutosave(
            failedAutosaveFingerprintRef.current,
            fingerprint,
            options.force === true,
          )
        ) {
          return { ok: false };
        }
        if (
          !options.force &&
          shouldSkipDuplicateVirtualStagingSave(
            savedFingerprintRef.current,
            fingerprint,
          )
        ) {
          setSaveStatus(draftIdRef.current ? "saved" : "not_saved");
          const currentDraftId = draftIdRef.current;
          const currentVersion = draftVersionRef.current;
          return currentDraftId && currentVersion
            ? { ok: true, draftId: currentDraftId, version: currentVersion }
            : { ok: false };
        }

        setSaveStatus("saving");
        setDraftError("");

        const currentDraftId = draftIdRef.current;
        if (!currentDraftId) {
          const result = await createOrderDraft(
            buildVirtualStagingCreateDraftInput(sourceSnapshot),
          );
          if (
            !shouldApplyVirtualStagingSaveResult(
              sessionAtEnqueue,
              draftSessionRef.current,
            )
          ) {
            return { ok: false };
          }
          if (!result.ok) {
            setSaveStatus("save_failed");
            setDraftError(result.message);
            failedAutosaveFingerprintRef.current = fingerprint;
            return { ok: false };
          }
          draftIdRef.current = result.data.id;
          draftVersionRef.current = result.data.version;
          setDraftId(result.data.id);
          setDraftVersion(result.data.version);
          savedFingerprintRef.current = fingerprint;
          failedAutosaveFingerprintRef.current = null;
          setDraftQueryParam(result.data.id);
          setSaveStatus("saved");
          return {
            ok: true,
            draftId: result.data.id,
            version: result.data.version,
          };
        }

        const expectedVersion = draftVersionRef.current;
        if (!expectedVersion) {
          setSaveStatus("save_failed");
          setDraftError(copy.versionNotReady);
          return { ok: false };
        }

        const result = await updateOrderDraft(
          currentDraftId,
          buildVirtualStagingUpdateDraftInput(sourceSnapshot, expectedVersion),
        );
        if (
          !shouldApplyVirtualStagingSaveResult(
            sessionAtEnqueue,
            draftSessionRef.current,
          )
        ) {
          return { ok: false };
        }
        if (!result.ok) {
          if (isOrderDraftVersionConflict(result)) {
            setSaveStatus("conflict");
            setConflictMessage(copy.conflictMessage);
            return { ok: false };
          }
          setSaveStatus("save_failed");
          setDraftError(result.message);
          failedAutosaveFingerprintRef.current = fingerprint;
          return { ok: false };
        }

        draftVersionRef.current = result.data.version;
        setDraftVersion(result.data.version);
        savedFingerprintRef.current = fingerprint;
        failedAutosaveFingerprintRef.current = null;
        setSaveStatus("saved");
        return {
          ok: true,
          draftId: currentDraftId,
          version: result.data.version,
        };
      };

      const savePromise = saveChainRef.current.then(run, run);
      saveChainRef.current = savePromise.then(
        () => undefined,
        () => undefined,
      );
      return savePromise;
    },
    [
      resumeState,
      saveStatus,
      setDraftQueryParam,
      copy,
    ],
  );

  const saveDraftNow = useCallback(
    async (options: { force?: boolean } = {}): Promise<boolean> => {
      const outcome = await enqueueDraftSave(
        buildDraftSourceSnapshot(),
        options,
      );
      return outcome.ok;
    },
    [buildDraftSourceSnapshot, enqueueDraftSave],
  );

  const handleDraftFileSelected = useCallback(
    async (
      index: number,
      kind: VirtualStagingDraftFileSlotKind,
      file: File | null,
    ) => {
      const currentItems = itemsRef.current;
      const item = currentItems[index];
      if (!item) return;

      const slotKey = buildVirtualStagingDraftFileSlotKey(
        item.clientItemId,
        kind,
      );
      const existingOperation = draftFileOperationsRef.current[slotKey];
      if (isVirtualStagingDraftFileSlotOperationActive(existingOperation)) {
        return;
      }
      const hadUploadedSummary =
        getVirtualStagingUploadedFileForSlot(
          uploadedDraftFilesRef.current,
          item.clientItemId,
          kind,
        ) !== null;

      if (!file) {
        if (existingOperation?.pendingFileId && draftIdRef.current) {
          void deleteOrderDraftFile(
            draftIdRef.current,
            existingOperation.pendingFileId,
          );
        }
        clearDraftFileOperation(slotKey, existingOperation?.generation ?? 0);
        const nextItems = currentItems.map((candidate, candidateIndex) => {
          if (candidateIndex !== index) return candidate;
          return kind === "original"
            ? {
                ...candidate,
                file: null,
                ...updateOriginalFileDraftMetadata(candidate, null),
              }
            : {
                ...candidate,
                referenceFile: null,
                ...updateReferenceFileDraftMetadata(candidate, null),
              };
        });
        setItems(nextItems);
        void enqueueDraftSave(buildDraftSourceSnapshot(nextItems));
        return;
      }

      const generation =
        nextVirtualStagingDraftFileOperationGeneration(existingOperation);
      const session: VirtualStagingDraftFileOperationSession = {
        draftSession: draftSessionRef.current,
        generation,
      };
      const controller = new AbortController();
      draftFileAbortControllersRef.current.set(slotKey, controller);

      const nextItems = currentItems.map((candidate, candidateIndex) => {
        if (candidateIndex !== index) return candidate;
        return kind === "original"
          ? {
              ...candidate,
              file,
              ...updateOriginalFileDraftMetadata(candidate, file),
            }
          : {
              ...candidate,
              referenceFile: file,
              ...updateReferenceFileDraftMetadata(candidate, file),
            };
      });
      setItems(nextItems);
      const sourceSnapshot = buildDraftSourceSnapshot(nextItems);

      setDraftFileOperation(slotKey, {
        status: "saving_draft",
        generation,
        error: null,
        pendingFileId: null,
      });

      try {
        const saveOutcome = await enqueueDraftSave(sourceSnapshot, {
          force: true,
        });
        if (!shouldApplyDraftFileOperation(slotKey, session)) return;
        if (!saveOutcome.ok) {
          setDraftFileOperation(slotKey, {
            status: "error",
            generation,
            error: copy.fileOperationFailed,
            pendingFileId: null,
          });
          return;
        }

        const prepareResult = await prepareOrderDraftFileUpload(
          saveOutcome.draftId,
          {
            itemClientId: item.clientItemId,
            kind,
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size,
          },
          controller.signal,
        );
        if (!shouldApplyDraftFileOperation(slotKey, session)) return;
        if (!prepareResult.ok) {
          setDraftFileOperation(slotKey, {
            status: "error",
            generation,
            error: safeDraftFileOperationMessage(
              prepareResult.code,
              copy.fileOperationFailed,
              prepareResult.message,
            ),
            pendingFileId: null,
          });
          return;
        }

        setDraftFileOperation(slotKey, {
          status: "uploading",
          generation,
          error: null,
          pendingFileId: prepareResult.data.file.id,
        });

        const uploadResult = await uploadPreparedOrderDraftFile(
          prepareResult.data,
          file,
        );
        if (!shouldApplyDraftFileOperation(slotKey, session)) return;
        if (!uploadResult.ok) {
          setDraftFileOperation(slotKey, {
            status: "error",
            generation,
            error: hadUploadedSummary
              ? `${copy.fileOperationFailed} ${copy.previousSavedFileAvailable}`
              : copy.fileOperationFailed,
            pendingFileId: prepareResult.data.file.id,
          });
          return;
        }

        const completeResult = await completeOrderDraftFileUpload(
          saveOutcome.draftId,
          prepareResult.data.file.id,
          controller.signal,
        );
        if (!shouldApplyDraftFileOperation(slotKey, session)) return;
        if (!completeResult.ok) {
          setDraftFileOperation(slotKey, {
            status: "error",
            generation,
            error: hadUploadedSummary
              ? `${copy.fileOperationFailed} ${copy.previousSavedFileAvailable}`
              : safeDraftFileOperationMessage(
                  completeResult.code,
                  copy.fileOperationFailed,
                  completeResult.message,
                ),
            pendingFileId: prepareResult.data.file.id,
          });
          return;
        }

        setUploadedDraftFiles((prev) => {
          const next = replaceVirtualStagingUploadedFileSummary(
            prev,
            completeResult.data,
          );
          uploadedDraftFilesRef.current = next;
          return next;
        });
        clearDraftFileOperation(slotKey, generation);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!shouldApplyDraftFileOperation(slotKey, session)) return;
        setDraftFileOperation(slotKey, {
          status: "error",
          generation,
          error: copy.fileOperationFailed,
          pendingFileId: null,
        });
      } finally {
        if (draftFileAbortControllersRef.current.get(slotKey) === controller) {
          draftFileAbortControllersRef.current.delete(slotKey);
        }
      }
    },
    [
      buildDraftSourceSnapshot,
      clearDraftFileOperation,
      copy.fileOperationFailed,
      copy.previousSavedFileAvailable,
      enqueueDraftSave,
      setDraftFileOperation,
      shouldApplyDraftFileOperation,
    ],
  );

  const handleUploadedFileRemove = useCallback(
    async (clientItemId: string, kind: VirtualStagingDraftFileSlotKind) => {
      const currentDraftId = draftIdRef.current;
      const uploaded = getVirtualStagingUploadedFileForSlot(
        uploadedDraftFilesRef.current,
        clientItemId,
        kind,
      );
      if (!currentDraftId || !uploaded) return;

      const slotKey = buildVirtualStagingDraftFileSlotKey(clientItemId, kind);
      const existingOperation = draftFileOperationsRef.current[slotKey];
      if (isVirtualStagingDraftFileSlotOperationActive(existingOperation)) {
        return;
      }
      const generation =
        nextVirtualStagingDraftFileOperationGeneration(existingOperation);
      const session: VirtualStagingDraftFileOperationSession = {
        draftSession: draftSessionRef.current,
        generation,
      };
      const controller = new AbortController();
      draftFileAbortControllersRef.current.set(slotKey, controller);

      setDraftFileOperation(slotKey, {
        status: "deleting",
        generation,
        error: null,
        pendingFileId: null,
      });

      try {
        const result = await deleteOrderDraftFile(
          currentDraftId,
          uploaded.id,
          controller.signal,
        );
        if (!shouldApplyDraftFileOperation(slotKey, session)) return;
        if (!result.ok) {
          setDraftFileOperation(slotKey, {
            status: "error",
            generation,
            error: result.message || copy.fileOperationFailed,
            pendingFileId: null,
          });
          return;
        }

        setUploadedDraftFiles((prev) => {
          const next = removeVirtualStagingUploadedFileSummary(
            prev,
            clientItemId,
            kind,
          );
          uploadedDraftFilesRef.current = next;
          return next;
        });
        const nextItems = itemsRef.current.map((item) => {
          if (item.clientItemId !== clientItemId) return item;
          return kind === "original"
            ? {
                ...item,
                file: null,
                ...updateOriginalFileDraftMetadata(item, null),
              }
            : {
                ...item,
                referenceFile: null,
                ...updateReferenceFileDraftMetadata(item, null),
              };
        });
        setItems(nextItems);
        clearDraftFileOperation(slotKey, generation);
        void enqueueDraftSave(buildDraftSourceSnapshot(nextItems), {
          force: true,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!shouldApplyDraftFileOperation(slotKey, session)) return;
        setDraftFileOperation(slotKey, {
          status: "error",
          generation,
          error: copy.fileOperationFailed,
          pendingFileId: null,
        });
      } finally {
        if (draftFileAbortControllersRef.current.get(slotKey) === controller) {
          draftFileAbortControllersRef.current.delete(slotKey);
        }
      }
    },
    [
      buildDraftSourceSnapshot,
      clearDraftFileOperation,
      copy.fileOperationFailed,
      enqueueDraftSave,
      setDraftFileOperation,
      shouldApplyDraftFileOperation,
    ],
  );

  const handleRemoveItem = useCallback(
    async (index: number) => {
      const item = itemsRef.current[index];
      if (!item) return;
      const currentDraftId = draftIdRef.current;
      const uploadedIds = collectVirtualStagingUploadedFileIdsForItem(
        uploadedDraftFilesRef.current,
        item.clientItemId,
      );

      if (uploadedIds.length === 0 || !currentDraftId) {
        const nextItems = itemsRef.current.filter((_, i) => i !== index);
        setItems(nextItems);
        return;
      }

      const slotKeys: string[] = ["original", "reference"].map((kind) =>
        buildVirtualStagingDraftFileSlotKey(
          item.clientItemId,
          kind as VirtualStagingDraftFileSlotKind,
        ),
      );
      if (
        slotKeys.some((slotKey) =>
          isVirtualStagingDraftFileSlotOperationActive(
            draftFileOperationsRef.current[slotKey],
          ),
        )
      ) {
        return;
      }

      const generation = Math.max(
        ...slotKeys.map((slotKey) =>
          nextVirtualStagingDraftFileOperationGeneration(
            draftFileOperationsRef.current[slotKey],
          ),
        ),
      );
      for (const slotKey of slotKeys) {
        setDraftFileOperation(slotKey, {
          status: "deleting",
          generation,
          error: null,
          pendingFileId: null,
        });
      }

      const results = await Promise.all(
        uploadedIds.map((fileId) => deleteOrderDraftFile(currentDraftId, fileId)),
      );
      const failed = results.some((result) => !result.ok);
      if (failed) {
        setDraftError(copy.itemFilesCouldNotDelete);
        for (const slotKey of slotKeys) {
          setDraftFileOperation(slotKey, {
            status: "error",
            generation,
            error: copy.itemFilesCouldNotDelete,
            pendingFileId: null,
          });
        }
        return;
      }

      const nextUploaded = uploadedDraftFilesRef.current.filter(
        (file) => file.itemClientId !== item.clientItemId,
      );
      uploadedDraftFilesRef.current = nextUploaded;
      setUploadedDraftFiles(nextUploaded);
      const nextItems = itemsRef.current.filter((_, i) => i !== index);
      setItems(nextItems);
      for (const slotKey of slotKeys) {
        clearDraftFileOperation(slotKey, generation);
      }
      void enqueueDraftSave(buildDraftSourceSnapshot(nextItems), {
        force: true,
      });
    },
    [
      buildDraftSourceSnapshot,
      clearDraftFileOperation,
      copy.itemFilesCouldNotDelete,
      enqueueDraftSave,
      setDraftFileOperation,
    ],
  );

  useEffect(() => {
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
      .then(async (result) => {
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
        await refreshUploadedDraftFiles(
          result.data.id,
          sessionAtStart,
          controller.signal,
        );
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
  }, [copy, refreshUploadedDraftFiles, requestedDraftId, setRegion]);

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
    await refreshUploadedDraftFiles(
      result.data.id,
      draftSessionRef.current,
    );
    setSaveStatus("saved");
    setResumeState("ready");
  };

  const handleRetryDraftFiles = async () => {
    const currentDraftId = draftIdRef.current;
    if (!currentDraftId) return;
    await refreshUploadedDraftFiles(
      currentDraftId,
      draftSessionRef.current,
    );
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
    isJobTitleValid(jobTitle) &&
    !hasActiveDraftFileOperation;

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
          disabled={saveStatus === "saving" || hasActiveDraftFileOperation}
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

      {draftFilesWarning && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p>{draftFilesWarning}</p>
          <button
            type="button"
            onClick={handleRetryDraftFiles}
            className="inline-flex w-full items-center justify-center rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 sm:w-auto"
          >
            {copy.retryFiles}
          </button>
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
        {items.map((item, index) => {
          const originalSlotKey = buildVirtualStagingDraftFileSlotKey(
            item.clientItemId,
            "original",
          );
          const referenceSlotKey = buildVirtualStagingDraftFileSlotKey(
            item.clientItemId,
            "reference",
          );
          const originalOperation = draftFileOperations[originalSlotKey];
          const referenceOperation = draftFileOperations[referenceSlotKey];
          const uploadedOriginalFile = uploadedFilesBySlot.get(originalSlotKey);
          const uploadedReferenceFile = uploadedFilesBySlot.get(referenceSlotKey);

          return (
            <StagingItemCard
              key={item.clientItemId}
              index={index}
              data={item}
              onChange={(data) => handleItemChange(index, data)}
              onRemove={() => void handleRemoveItem(index)}
              canRemove={items.length > 1}
              draftCopy={{
                savedOriginalFile: copy.savedOriginalFile,
                savedReferenceFile: copy.savedReferenceFile,
              }}
              uploadedOriginalFile={uploadedOriginalFile}
              uploadedReferenceFile={uploadedReferenceFile}
              originalOperationStatusText={operationStatusText(
                originalOperation,
                copy,
              )}
              referenceOperationStatusText={operationStatusText(
                referenceOperation,
                copy,
              )}
              originalOperationErrorText={originalOperation?.error ?? undefined}
              referenceOperationErrorText={referenceOperation?.error ?? undefined}
              originalBusy={isVirtualStagingDraftFileSlotOperationActive(
                originalOperation,
              )}
              referenceBusy={isVirtualStagingDraftFileSlotOperationActive(
                referenceOperation,
              )}
              onOriginalFileSelected={(file) =>
                void handleDraftFileSelected(index, "original", file)
              }
              onReferenceFileSelected={(file) =>
                void handleDraftFileSelected(index, "reference", file)
              }
              onRemoveUploadedOriginal={() =>
                void handleUploadedFileRemove(item.clientItemId, "original")
              }
              onRemoveUploadedReference={() =>
                void handleUploadedFileRemove(item.clientItemId, "reference")
              }
              onRetryOriginalUpload={() =>
                item.file
                  ? void handleDraftFileSelected(index, "original", item.file)
                  : undefined
              }
              onRetryReferenceUpload={() =>
                item.referenceFile
                  ? void handleDraftFileSelected(
                      index,
                      "reference",
                      item.referenceFile,
                    )
                  : undefined
              }
              retryUploadLabel={copy.retryUpload}
              replaceFileLabel={copy.replaceFile}
              removeSavedFileLabel={copy.removeSavedFile}
              savedInDraftLabel={copy.savedInDraft}
            />
          );
        })}
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

function operationStatusText(
  operation: VirtualStagingDraftFileOperation | undefined,
  copy: DraftCopy,
): string | undefined {
  if (!operation) return undefined;
  if (operation.status === "saving_draft") return copy.fileSavingDraft;
  if (operation.status === "uploading") return copy.fileUploading;
  if (operation.status === "deleting") return copy.fileDeleting;
  return undefined;
}

function safeDraftFileOperationMessage(
  code: string,
  fallback: string,
  message: string,
): string {
  if (
    code === "unauthenticated" ||
    code === "not_found" ||
    code === "invalid_status" ||
    code === "version_conflict"
  ) {
    return message || fallback;
  }
  return fallback;
}
