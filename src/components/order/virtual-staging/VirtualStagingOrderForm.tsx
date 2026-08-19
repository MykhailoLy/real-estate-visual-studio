"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, RotateCcw } from "lucide-react";
import OrderLayout from "@/components/order/OrderLayout";
import OrderSummary, { type SummaryItem } from "@/components/order/OrderSummary";
import OrderStepIndicator, {
  type OrderStep,
} from "@/components/order/OrderStepIndicator";
import {
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
  getStagingRequiredFieldId,
  stagingItemDomId,
  type StagingRequiredField,
} from "@/components/order/virtual-staging/StagingItemCard";
import ApplyStyleConfirmationDialog from "@/components/order/virtual-staging/ApplyStyleConfirmationDialog";
import StyleSelector from "@/components/order/virtual-staging/StyleSelector";
import VirtualStagingReview from "@/components/order/virtual-staging/VirtualStagingReview";
import {
  applyFurnitureStyleToAll,
  countIndividualFurnitureStyles,
  requestGlobalFurnitureStyleChange,
} from "@/components/order/virtual-staging/virtual-staging-style-state";
import {
  applyVirtualStagingInitialAddOns,
  shouldAllowVirtualStagingSupportPrefillAutosave,
  shouldPreserveVirtualStagingSupportRecommendationForDraft,
} from "@/components/order/virtual-staging/staging-item-prefill";
import { redirectOnOrderAuthError } from "@/components/order/order-redirect";
import {
  RegionalCentsText,
  useDisplayRegion,
} from "@/components/pricing/currency-client";
import { submitOrder, type OrderSubmitResult } from "@/lib/submit-order";
import Container from "@/components/layout/Container";
import {
  scrollDashboardToTop,
  scrollElementIntoViewWithinDashboard,
} from "@/lib/dashboard-scroll";
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
import type { OrderDraftRow } from "@/lib/order-drafts/types";
import type { ServiceOptionMedia } from "@/lib/site-media";
import { UuidSchema } from "@/lib/order-drafts/schema";
import {
  buildVirtualStagingDraftFingerprint,
  buildVirtualStagingCreateDraftInput,
  buildVirtualStagingUpdateDraftInput,
  findMissingVirtualStagingRequiredFields,
  hasMeaningfulVirtualStagingDraftChange,
  resetVirtualStagingDraftIdentity,
  resolveVirtualStagingDraftRegion,
  shouldApplyVirtualStagingSaveResult,
  shouldSkipDuplicateVirtualStagingSave,
  shouldSkipFailedVirtualStagingAutosave,
  updateOriginalFileDraftMetadata,
  updateReferenceFileDraftMetadata,
  validateVirtualStagingDraftForResume,
  type VirtualStagingAutosaveStatus,
  type VirtualStagingFormDraftSource,
  type MissingVirtualStagingRequiredField,
} from "@/lib/order-drafts/virtual-staging";
import {
  getVirtualStagingDraftFinalizationStatus,
  submitVirtualStagingDraft,
  type DraftFinalizationClientResult,
} from "@/lib/order-drafts/finalization-client";
import {
  buildVirtualStagingFinalizationRetryStorageKey,
  parseVirtualStagingFinalizationRetryContext,
  selectVirtualStagingDraftSubmissionMode,
  serializeVirtualStagingFinalizationRetryContext,
  shouldApplyVirtualStagingFinalizationResult,
  shouldPreserveVirtualStagingFinalizationKeyAfterFailure,
  type DraftFinalizationStatusDto,
  type VirtualStagingFinalizationRetryContext,
} from "@/lib/order-drafts/finalization";
import {
  buildVirtualStagingDraftFileSlotKey,
  clearVirtualStagingCleanupPendingTarget,
  clearVirtualStagingDraftFileOperation,
  collectVirtualStagingItemCleanupTargets,
  getVirtualStagingUploadedFileForSlot,
  hasActiveVirtualStagingDraftFileOperation,
  indexVirtualStagingUploadedFilesBySlot,
  isVirtualStagingDraftFileSlotOperationActive,
  isTrustedVirtualStagingCleanupAlreadyAbsent,
  mapVirtualStagingPrepareConflictAction,
  nextVirtualStagingDraftFileOperationGeneration,
  removeVirtualStagingUploadedFileSummary,
  removeVirtualStagingCleanupTargetFromRetrySet,
  replaceVirtualStagingUploadedFileSummary,
  resolveVirtualStagingCommittedItems,
  resetVirtualStagingDraftFileState,
  shouldApplyVirtualStagingItemRemovalResult,
  shouldFinishVirtualStagingItemRemoval,
  shouldApplyVirtualStagingDraftFileOperationResult,
  type VirtualStagingDraftFileCleanupTarget,
  type VirtualStagingDraftFileOperation,
  type VirtualStagingDraftFileOperationMap,
  type VirtualStagingDraftFileOperationSession,
  type VirtualStagingDraftFileSlotKind,
  type VirtualStagingItemUpdate,
} from "@/lib/order-drafts/virtual-staging-files";
import {
  consumeSupportOrderPrefill,
  getSupportOrderPrefillStorage,
} from "@/lib/support-order-prefill";
import {
  completeDraftReferenceFile,
  deleteDraftReferenceFile,
  listDraftReferenceFiles,
  prepareDraftReferenceFile,
  uploadPreparedDraftReferenceFile,
} from "@/lib/order-drafts/draft-reference-files-client";
import type { ReferenceFileValue } from "@/lib/reference-files";

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
  exampleMediaByKey: Record<string, ServiceOptionMedia>;
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
  creatingOrder: string;
  retryOrderFinalization: string;
  finishOrderCreation: string;
  finalizationRecoveryTitle: string;
  finalizationRecoveryMessage: string;
  finalizationInProgressTitle: string;
  finalizationInProgressMessage: string;
  existingOrder: string;
  checkAgain: string;
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
  incompleteFields: (count: number) => string;
  waitForImages: string;
  jobTitleRequired: string;
  originalRequired: (itemNumber: number) => string;
  roomRequired: (itemNumber: number) => string;
  styleRequired: (itemNumber: number) => string;
  termsRequired: string;
  jobTitleLabel: string;
  originalLabel: (itemNumber: number) => string;
  roomLabel: (itemNumber: number) => string;
  styleLabel: (itemNumber: number) => string;
  termsLabel: string;
  supportRecommendationTitle: string;
  supportRecommendationMessage: string;
  supportRecommendationDismiss: string;
};

type DraftSaveOutcome =
  | { ok: true; draftId: string; version: number }
  | { ok: false };

type ItemUpdate = VirtualStagingItemUpdate<StagingItemData>;
type UploadedDraftFilesUpdate =
  VirtualStagingItemUpdate<OrderDraftUploadedFileSummary>;

type FinalizationRetryContext = VirtualStagingFinalizationRetryContext;

type FinalizationRecoveryState =
  | {
      status: "reconciliation_required";
      draftId: string;
      expectedVersion: number;
      orderId: string;
      orderNumber: string;
    }
  | {
      status: "finalization_in_progress";
      draftId: string;
      expectedVersion: number;
    };

type VirtualStagingFormStep = "configure" | "review";

const STEPS: OrderStep[] = [
  { id: "configure", label: "Configure Order" },
  { id: "review", label: "Review & Submit" },
];

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
      "Your images are saved with this draft and will be used when you submit the order.",
    conflictMessage:
      "This draft changed in another tab. Reload latest draft or keep editing without autosave.",
    keepEditingActive:
      "Keep editing is active. Autosave is paused until you reload the latest draft.",
    versionNotReady: "Draft version is not ready yet.",
    signInAgain: "Please sign in again to restore this draft.",
    restoreFailed: "Draft could not be restored. Please try again.",
    savedOriginalFile: (filename: string) =>
      `Saved with draft: ${filename}. It will be used when you submit.`,
    savedReferenceFile: (filename: string) =>
      `Saved with draft: ${filename}. It will be used when you submit.`,
    savedInDraft: "Saved in draft",
    creatingOrder: "Creating order...",
    retryOrderFinalization: "Retry order finalization",
    finishOrderCreation: "Finish order creation",
    finalizationRecoveryTitle: "Finish order creation",
    finalizationRecoveryMessage:
      "Your order was created and the draft needs one final recovery step.",
    finalizationInProgressTitle: "Order creation is still in progress",
    finalizationInProgressMessage:
      "Please try again shortly. We will not create another order.",
    existingOrder: "Existing order",
    checkAgain: "Check again",
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
    incompleteFields: (count) =>
      `Complete ${count} required ${count === 1 ? "field" : "fields"} before submitting.`,
    waitForImages: "Please wait for your images to finish uploading.",
    jobTitleRequired: "Enter a job title.",
    originalRequired: (itemNumber) =>
      `Image #${itemNumber}: upload an original photo.`,
    roomRequired: (itemNumber) =>
      `Image #${itemNumber}: select a room or area.`,
    styleRequired: (itemNumber) =>
      `Image #${itemNumber}: select a furniture style.`,
    termsRequired: "Accept the terms before submitting.",
    jobTitleLabel: "Job title",
    originalLabel: (itemNumber) => `Image #${itemNumber} original photo`,
    roomLabel: (itemNumber) => `Image #${itemNumber} room`,
    styleLabel: (itemNumber) => `Image #${itemNumber} furniture style`,
    termsLabel: "Terms",
    supportRecommendationTitle: "Recommendation applied",
    supportRecommendationMessage:
      "Image Enhancement was selected based on your PicchuSpot Assistant conversation. You can remove it from any image.",
    supportRecommendationDismiss: "Dismiss",
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
      "Tus imágenes están guardadas con este borrador y se utilizarán al enviar el pedido.",
    conflictMessage:
      "Este borrador cambió en otra pestaña. Recarga el borrador más reciente o sigue editando sin autoguardado.",
    keepEditingActive:
      "Seguir editando está activo. El autoguardado está pausado hasta que recargues el borrador más reciente.",
    versionNotReady: "La versión del borrador todavía no está lista.",
    signInAgain: "Inicia sesión otra vez para restaurar este borrador.",
    restoreFailed: "No se pudo restaurar el borrador. Inténtalo de nuevo.",
    savedOriginalFile: (filename: string) =>
      `Guardado con el borrador: ${filename}. Se utilizará al enviar.`,
    savedReferenceFile: (filename: string) =>
      `Guardado con el borrador: ${filename}. Se utilizará al enviar.`,
    savedInDraft: "Guardado en el borrador",
    creatingOrder: "Creando pedido...",
    retryOrderFinalization: "Reintentar finalizacion del pedido",
    finishOrderCreation: "Finalizar creacion del pedido",
    finalizationRecoveryTitle: "Finalizar creacion del pedido",
    finalizationRecoveryMessage:
      "Tu pedido ya fue creado y el borrador necesita un ultimo paso de recuperacion.",
    finalizationInProgressTitle: "La creacion del pedido sigue en curso",
    finalizationInProgressMessage:
      "Intentalo de nuevo en breve. No crearemos otro pedido.",
    existingOrder: "Pedido existente",
    checkAgain: "Comprobar de nuevo",
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
    incompleteFields: (count) =>
      `Completa ${count} ${count === 1 ? "campo obligatorio" : "campos obligatorios"} antes de enviar.`,
    waitForImages: "Espera a que tus imágenes terminen de subirse.",
    jobTitleRequired: "Introduce un título para el pedido.",
    originalRequired: (itemNumber) =>
      `Imagen #${itemNumber}: sube una foto original.`,
    roomRequired: (itemNumber) =>
      `Imagen #${itemNumber}: selecciona una habitación o zona.`,
    styleRequired: (itemNumber) =>
      `Imagen #${itemNumber}: selecciona un estilo de mobiliario.`,
    termsRequired: "Acepta los términos antes de enviar.",
    jobTitleLabel: "Título del pedido",
    originalLabel: (itemNumber) => `Imagen #${itemNumber} foto original`,
    roomLabel: (itemNumber) => `Imagen #${itemNumber} habitación`,
    styleLabel: (itemNumber) => `Imagen #${itemNumber} estilo`,
    termsLabel: "Términos",
    supportRecommendationTitle: "Recomendación aplicada",
    supportRecommendationMessage:
      "Se ha seleccionado Image Enhancement según tu conversación con el asistente de PicchuSpot. Puedes quitarlo de cualquier imagen.",
    supportRecommendationDismiss: "Cerrar",
  },
};

const JOB_TITLE_REQUIRED_FIELD_ID = "virtual-staging-job-title-required";
const TERMS_REQUIRED_FIELD_ID = "virtual-staging-terms-required";

interface RequiredFieldIssue extends MissingVirtualStagingRequiredField {
  targetId: string;
  message: string;
  summaryLabel: string;
}

function buildRequiredFieldIssues(
  missing: MissingVirtualStagingRequiredField[],
  copy: DraftCopy,
): RequiredFieldIssue[] {
  return missing.map((field) => {
    const itemNumber = (field.itemIndex ?? 0) + 1;

    if (field.kind === "job-title") {
      return {
        ...field,
        targetId: JOB_TITLE_REQUIRED_FIELD_ID,
        message: copy.jobTitleRequired,
        summaryLabel: copy.jobTitleLabel,
      };
    }
    if (field.kind === "terms") {
      return {
        ...field,
        targetId: TERMS_REQUIRED_FIELD_ID,
        message: copy.termsRequired,
        summaryLabel: copy.termsLabel,
      };
    }

    const clientItemId = field.clientItemId ?? "";
    const stagingField: StagingRequiredField = field.kind;
    const targetId = getStagingRequiredFieldId(clientItemId, stagingField);
    if (field.kind === "original") {
      return {
        ...field,
        targetId,
        message: copy.originalRequired(itemNumber),
        summaryLabel: copy.originalLabel(itemNumber),
      };
    }
    if (field.kind === "room") {
      return {
        ...field,
        targetId,
        message: copy.roomRequired(itemNumber),
        summaryLabel: copy.roomLabel(itemNumber),
      };
    }
    return {
      ...field,
      targetId,
      message: copy.styleRequired(itemNumber),
      summaryLabel: copy.styleLabel(itemNumber),
    };
  });
}

function focusRequiredField(targetId: string): void {
  window.requestAnimationFrame(() => {
    const field = document.getElementById(targetId);
    if (!field) return;
    const control = field.querySelector<HTMLElement>(
      "[data-validation-control], input:not([type='hidden']), select, button:not([disabled])",
    );
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    control?.focus({ preventScroll: true });
  });
}

export default function VirtualStagingOrderForm({
  clientEmail,
  orderRoute,
  exampleMediaByKey,
}: VirtualStagingOrderFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedDraftId = searchParams.get("draft");
  const supportRecommendationTitleId = useId();
  const globalStyleLabelId = useId();
  const globalStyleHelperId = useId();
  const [region, setRegion] = useDisplayRegion();
  const currency = currencyForRegion(region);
  const [savedLanguage, setSavedLanguage] = useState<SiteLanguage | null>(null);
  const language = getCurrentLanguage(pathname, savedLanguage);
  const copy = DRAFT_COPY[language];
  const [items, setItems] = useState<StagingItemData[]>([emptyStagingItem()]);
  const [defaultFurnitureStyle, setDefaultFurnitureStyle] = useState("");
  const [pendingGlobalStyle, setPendingGlobalStyle] = useState<string | null>(
    null,
  );
  const [jobTitle, setJobTitle] = useState("");
  const [orderTerms, setOrderTerms] = useState<OrderTermsData>(emptyOrderTerms);
  const [step, setStep] = useState<VirtualStagingFormStep>("configure");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [validationAttempted, setValidationAttempted] = useState(false);
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
    | "idle"
    | "loading"
    | "ready"
    | "not_found"
    | "unsupported"
    | "error"
    | "finalization_recovery"
  >(() => (requestedDraftId ? "loading" : "ready"));
  const [conflictMessage, setConflictMessage] = useState("");
  const [uploadedDraftFiles, setUploadedDraftFiles] = useState<
    OrderDraftUploadedFileSummary[]
  >([]);
  const [draftFileOperations, setDraftFileOperations] =
    useState<VirtualStagingDraftFileOperationMap>({});
  const [draftFilesWarning, setDraftFilesWarning] = useState("");
  const [finalizationKey, setFinalizationKey] = useState<string | null>(null);
  const [finalizationRetryContext, setFinalizationRetryContext] =
    useState<FinalizationRetryContext | null>(null);
  const [finalizationRecovery, setFinalizationRecovery] =
    useState<FinalizationRecoveryState | null>(null);
  const [supportPrefillReady, setSupportPrefillReady] = useState(false);
  const [
    supportRecommendationNoticeVisible,
    setSupportRecommendationNoticeVisible,
  ] = useState(false);

  const draftIdRef = useRef(draftId);
  const draftVersionRef = useRef(draftVersion);
  const itemsRef = useRef(items);
  const uploadedDraftFilesRef = useRef(uploadedDraftFiles);
  const draftFileOperationsRef = useRef(draftFileOperations);
  const finalizationKeyRef = useRef(finalizationKey);
  const finalizationRetryContextRef = useRef(finalizationRetryContext);
  const supportRecommendedAddOnIdsRef = useRef<string[]>([]);
  const supportRecommendationAppliedRef = useRef(false);
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
  const pendingScrollRef = useRef<
    | { type: "top" }
    | { type: "item"; clientItemId: string }
    | null
  >(null);
  const submissionInFlightRef = useRef(false);

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
    const pending = pendingScrollRef.current;
    if (!pending) return;
    pendingScrollRef.current = null;
    const raf = requestAnimationFrame(() => {
      if (pending.type === "item") {
        scrollElementIntoViewWithinDashboard(
          stagingItemDomId(pending.clientItemId),
        );
      } else {
        scrollDashboardToTop();
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [step]);

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
    finalizationKeyRef.current = finalizationKey;
  }, [finalizationKey]);

  useEffect(() => {
    finalizationRetryContextRef.current = finalizationRetryContext;
  }, [finalizationRetryContext]);

  useEffect(() => {
    isRestoringRef.current = resumeState === "loading";
  }, [resumeState]);

  const storeFinalizationRetryContext = useCallback(
    (context: FinalizationRetryContext) => {
      finalizationRetryContextRef.current = context;
      setFinalizationRetryContext(context);
      writeStoredFinalizationRetryContext(context);
    },
    [],
  );

  const clearFinalizationRetryContext = useCallback(() => {
    const context = finalizationRetryContextRef.current;
    const currentDraftId = context?.draftId ?? draftIdRef.current;
    if (currentDraftId) removeStoredFinalizationRetryContext(currentDraftId);
    finalizationRetryContextRef.current = null;
    setFinalizationRetryContext(null);
  }, []);

  const commitItems = useCallback((next: ItemUpdate): StagingItemData[] => {
    const current = itemsRef.current;
    const resolved = resolveVirtualStagingCommittedItems(current, next);
    itemsRef.current = resolved;
    setItems(resolved);
    return resolved;
  }, []);

  const commitUploadedDraftFiles = useCallback(
    (
      next: UploadedDraftFilesUpdate,
    ): OrderDraftUploadedFileSummary[] => {
      const current = uploadedDraftFilesRef.current;
      const resolved = resolveVirtualStagingCommittedItems(current, next);
      uploadedDraftFilesRef.current = resolved;
      setUploadedDraftFiles(resolved);
      return resolved;
    },
    [],
  );

  const handleItemChange = (index: number, data: StagingItemData) => {
    if (finalizationRetryContextRef.current) return;
    commitItems((prev) => prev.map((item, i) => (i === index ? data : item)));
  };

  const applyGlobalStyle = (furnitureStyle: string) => {
    setDefaultFurnitureStyle(furnitureStyle);
    commitItems((prev) => applyFurnitureStyleToAll(prev, furnitureStyle));
  };

  const handleGlobalStyleChange = (furnitureStyle: string) => {
    if (isSubmitting || finalizationRetryContextRef.current) return;
    const request = requestGlobalFurnitureStyleChange(
      itemsRef.current,
      defaultFurnitureStyle,
      furnitureStyle,
    );
    if (request.kind === "confirm") {
      setPendingGlobalStyle(furnitureStyle);
      return;
    }
    if (request.kind === "apply") applyGlobalStyle(furnitureStyle);
  };

  const confirmGlobalStyleChange = () => {
    if (!pendingGlobalStyle) return;
    applyGlobalStyle(pendingGlobalStyle);
    setPendingGlobalStyle(null);
  };

  const handleAddItem = () => {
    if (isSubmitting || finalizationRetryContextRef.current) return;
    commitItems((prev) => [
      ...prev,
      applyVirtualStagingInitialAddOns(
        emptyStagingItem(defaultFurnitureStyle),
        supportRecommendedAddOnIdsRef.current,
      ),
    ]);
  };

  const draftSource = useMemo(
    () => ({
      jobTitle,
      defaultFurnitureStyle,
      items,
      orderTerms,
      currency,
      region,
    }),
    [currency, defaultFurnitureStyle, items, jobTitle, orderTerms, region],
  );

  const buildDraftSourceSnapshot = useCallback(
    (snapshotItems: StagingItemData[] = itemsRef.current):
      VirtualStagingFormDraftSource => ({
        jobTitle,
        defaultFurnitureStyle,
        items: snapshotItems,
        orderTerms,
        currency,
        region,
      }),
    [currency, defaultFurnitureStyle, jobTitle, orderTerms, region],
  );

  const setDraftFileOperation = useCallback(
    (slotKey: string, operation: VirtualStagingDraftFileOperation) => {
      const next = {
        ...draftFileOperationsRef.current,
        [slotKey]: operation,
      };
      draftFileOperationsRef.current = next;
      setDraftFileOperations(next);
    },
    [],
  );

  const clearDraftFileOperation = useCallback(
    (slotKey: string, generation: number) => {
      const next = clearVirtualStagingDraftFileOperation(
        draftFileOperationsRef.current,
        slotKey,
        generation,
      );
      draftFileOperationsRef.current = next;
      setDraftFileOperations(next);
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
      commitUploadedDraftFiles(result.data);
      return true;
    },
    [commitUploadedDraftFiles, copy.filesCouldNotRestore],
  );

  const applyRestoredDraft = useCallback(
    async (
      draft: OrderDraftRow,
      sessionAtStart: number,
      signal?: AbortSignal,
    ): Promise<void> => {
      const resume = validateVirtualStagingDraftForResume(draft);
      if (!resume.ok) {
        setResumeState("unsupported");
        setDraftError(resume.message);
        return;
      }

      let restoredItems = resume.form.items;
      const restoredReferences = await listDraftReferenceFiles(draft.id);
      if (restoredReferences.ok) {
        restoredItems = restoredItems.map((item) => ({
          ...item,
          referenceFiles: restoredReferences.data.filter(
            (reference) => reference.itemClientId === item.clientItemId,
          ),
        }));
      }
      commitItems(restoredItems);
      setJobTitle(resume.form.jobTitle);
      setDefaultFurnitureStyle(resume.form.defaultFurnitureStyle);
      setPendingGlobalStyle(null);
      setOrderTerms(resume.form.orderTerms);
      const restoredRegion = resolveVirtualStagingDraftRegion(draft);
      const restoredCurrency = currencyForRegion(restoredRegion);
      setRegion(restoredRegion);
      setDraftId(draft.id);
      setDraftVersion(resume.version);
      draftIdRef.current = draft.id;
      draftVersionRef.current = resume.version;
      savedFingerprintRef.current = buildVirtualStagingDraftFingerprint({
        jobTitle: resume.form.jobTitle,
        defaultFurnitureStyle: resume.form.defaultFurnitureStyle,
        items: restoredItems,
        orderTerms: resume.form.orderTerms,
        currency: restoredCurrency,
        region: restoredRegion,
      });
      failedAutosaveFingerprintRef.current = null;
      setSaveStatus("saved");
      setFinalizationRecovery(null);
      setFinalizationKey(null);
      finalizationKeyRef.current = null;
      clearFinalizationRetryContext();
      await refreshUploadedDraftFiles(draft.id, sessionAtStart, signal);
      setResumeState("ready");
    },
    [
      clearFinalizationRetryContext,
      commitItems,
      refreshUploadedDraftFiles,
      setRegion,
    ],
  );

  const applyFinalizationStatus = useCallback(
    (status: DraftFinalizationStatusDto): void => {
      setDraftId(status.draftId);
      draftIdRef.current = status.draftId;
      setDraftVersion(status.expectedVersion ?? null);
      draftVersionRef.current = status.expectedVersion ?? null;
      setDraftError("");
      setSubmitError("");

      if (status.status === "reconciliation_required") {
        const storedContext = readStoredFinalizationRetryContext(status.draftId);
        if (storedContext) {
          finalizationKeyRef.current = storedContext.finalizationKey;
          setFinalizationKey(storedContext.finalizationKey);
          storeFinalizationRetryContext(storedContext);
        } else {
          setFinalizationKey(null);
          finalizationKeyRef.current = null;
          clearFinalizationRetryContext();
        }
        setFinalizationRecovery({
          status: "reconciliation_required",
          draftId: status.draftId,
          expectedVersion: status.expectedVersion,
          orderId: status.orderId,
          orderNumber: status.orderNumber,
        });
        setResumeState("finalization_recovery");
        return;
      }

      if (status.status === "finalization_in_progress") {
        setFinalizationKey(null);
        finalizationKeyRef.current = null;
        clearFinalizationRetryContext();
        setFinalizationRecovery({
          status: "finalization_in_progress",
          draftId: status.draftId,
          expectedVersion: status.expectedVersion ?? 1,
        });
        setResumeState("finalization_recovery");
        return;
      }

      setFinalizationRecovery(null);
      setFinalizationKey(null);
      finalizationKeyRef.current = null;
      clearFinalizationRetryContext();

      if (status.status === "already_converted") {
        setOrderNumber(status.orderNumber);
        setConfirmationEmailSent(false);
        setSubmitted(true);
        setIsSubmitting(false);
        return;
      }

      if (status.status === "active") {
        setResumeState("error");
        setDraftError(copy.restoreFailed);
        return;
      }

      setResumeState("not_found");
    },
    [
      clearFinalizationRetryContext,
      copy.restoreFailed,
      storeFinalizationRetryContext,
    ],
  );

  const hasMeaningfulDraft = useMemo(
    () => hasMeaningfulVirtualStagingDraftChange(draftSource),
    [draftSource],
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

  const requiredFieldInput = useMemo(
    () => ({
      jobTitleValid: isJobTitleValid(jobTitle),
      items: items.map((item) => ({
        clientItemId: item.clientItemId,
        hasOriginal:
          item.file !== null ||
          uploadedFilesBySlot.has(
            buildVirtualStagingDraftFileSlotKey(item.clientItemId, "original"),
          ),
        roomName: item.roomName,
        furnitureStyle: item.furnitureStyle,
      })),
    }),
    [items, jobTitle, uploadedFilesBySlot],
  );

  // Terms belong to the final review step. Configuration validation uses the
  // same field rules but deliberately treats terms as accepted so the client
  // can advance without being asked to confirm too early.
  const configurationMissingRequiredFields = useMemo(
    () =>
      buildRequiredFieldIssues(
        findMissingVirtualStagingRequiredFields({
          ...requiredFieldInput,
          termsAccepted: true,
        }),
        copy,
      ),
    [copy, requiredFieldInput],
  );

  const missingRequiredFields = useMemo(
    () =>
      buildRequiredFieldIssues(
        findMissingVirtualStagingRequiredFields({
          ...requiredFieldInput,
          termsAccepted: orderTerms.accepted,
        }),
        copy,
      ),
    [copy, orderTerms.accepted, requiredFieldInput],
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

    commitItems([emptyStagingItem()]);
    commitUploadedDraftFiles(fileReset.uploadedFiles);
    setDraftFileOperations(fileReset.operations);
    draftFileOperationsRef.current = fileReset.operations;
    setDraftFilesWarning(fileReset.warning);
    setJobTitle("");
    setDefaultFurnitureStyle("");
    setPendingGlobalStyle(null);
    setOrderTerms(emptyOrderTerms);
    setStep("configure");
    pendingScrollRef.current = { type: "top" };
    setSubmitted(false);
    setOrderNumber("");
    setConfirmationEmailSent(false);
    setSubmitError("");
    setValidationAttempted(false);
    submissionInFlightRef.current = false;
    setFinalizationKey(null);
    finalizationKeyRef.current = null;
    clearFinalizationRetryContext();
    setFinalizationRecovery(null);
    supportRecommendedAddOnIdsRef.current = [];
    supportRecommendationAppliedRef.current = false;
    setSupportRecommendationNoticeVisible(false);
    setSupportPrefillReady(true);
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
  }, [
    clearFinalizationRetryContext,
    commitItems,
    commitUploadedDraftFiles,
    replaceDraftUrl,
    searchParams,
  ]);

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
        if (finalizationRetryContextRef.current) {
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
      if (isSubmitting || finalizationRetryContextRef.current) return;
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
        commitItems(nextItems);
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
      commitItems(nextItems);
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
          if (
            mapVirtualStagingPrepareConflictAction(prepareResult.code) ===
            "draft_conflict"
          ) {
            setSaveStatus("conflict");
            setConflictMessage(copy.conflictMessage);
          }
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

        commitUploadedDraftFiles((prev) =>
          replaceVirtualStagingUploadedFileSummary(
            prev,
            completeResult.data,
          ),
        );
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
      commitItems,
      commitUploadedDraftFiles,
      copy.conflictMessage,
      copy.fileOperationFailed,
      copy.previousSavedFileAvailable,
      enqueueDraftSave,
      isSubmitting,
      setDraftFileOperation,
      shouldApplyDraftFileOperation,
    ],
  );

  const handleUploadedFileRemove = useCallback(
    async (clientItemId: string, kind: VirtualStagingDraftFileSlotKind) => {
      if (isSubmitting || finalizationRetryContextRef.current) return;
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

        commitUploadedDraftFiles((prev) =>
          removeVirtualStagingUploadedFileSummary(
            prev,
            clientItemId,
            kind,
          ),
        );
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
        commitItems(nextItems);
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
      commitItems,
      commitUploadedDraftFiles,
      copy.fileOperationFailed,
      enqueueDraftSave,
      isSubmitting,
      setDraftFileOperation,
      shouldApplyDraftFileOperation,
    ],
  );

  const handleReferenceFilesChange = useCallback(
    async (index: number, nextReferences: ReferenceFileValue[]) => {
      if (isSubmitting || finalizationRetryContextRef.current) return;
      const item = itemsRef.current[index];
      if (!item) return;
      const previous = item.referenceFiles;
      const nextItems = itemsRef.current.map((candidate, candidateIndex) =>
        candidateIndex === index
          ? { ...candidate, referenceFiles: nextReferences }
          : candidate,
      );
      commitItems(nextItems);
      const removed = previous.filter(
        (reference) =>
          reference.draftFileId &&
          !nextReferences.some((candidate) => candidate.id === reference.id),
      );
      const additions = nextReferences.filter(
        (reference) =>
          reference.file &&
          !previous.some((candidate) => candidate.id === reference.id),
      );
      if (removed.length === 0 && additions.length === 0) return;

      const slotKey = buildVirtualStagingDraftFileSlotKey(
        item.clientItemId,
        "reference",
      );
      const generation = nextVirtualStagingDraftFileOperationGeneration(
        draftFileOperationsRef.current[slotKey],
      );
      setDraftFileOperation(slotKey, {
        status: "saving_draft",
        generation,
        error: null,
        pendingFileId: null,
      });
      const saved = await enqueueDraftSave(buildDraftSourceSnapshot(nextItems), {
        force: true,
      });
      if (!saved.ok) {
        setDraftFileOperation(slotKey, {
          status: "error",
          generation,
          error: copy.fileOperationFailed,
          pendingFileId: null,
        });
        return;
      }
      let working = nextReferences;
      for (const reference of removed) {
        const deleted = await deleteDraftReferenceFile(saved.draftId, reference.id);
        if (!deleted.ok) setDraftError(deleted.message);
      }
      for (const reference of additions) {
        if (!reference.file) continue;
        const position = working.findIndex((candidate) => candidate.id === reference.id);
        const prepared = await prepareDraftReferenceFile(saved.draftId, {
          itemClientId: item.clientItemId,
          referenceId: reference.id,
          position,
          filename: reference.filename,
          fileSize: reference.fileSize,
          mimeType: reference.mimeType as "image/jpeg" | "image/png" | "image/webp" | "application/pdf",
        });
        if (!prepared.ok) {
          setDraftError(prepared.message);
          continue;
        }
        const uploaded = await uploadPreparedDraftReferenceFile(prepared.data, reference.file);
        if (!uploaded.ok) {
          setDraftError(uploaded.message);
          await deleteDraftReferenceFile(saved.draftId, reference.id);
          continue;
        }
        const completed = await completeDraftReferenceFile(saved.draftId, reference.id);
        if (!completed.ok) {
          setDraftError(completed.message);
          await deleteDraftReferenceFile(saved.draftId, reference.id);
          continue;
        }
        working = working.map((candidate) =>
          candidate.id === reference.id ? completed.data : candidate,
        );
      }
      const committed = itemsRef.current.map((candidate, candidateIndex) =>
        candidateIndex === index
          ? { ...candidate, referenceFiles: working }
          : candidate,
      );
      commitItems(committed);
      void enqueueDraftSave(buildDraftSourceSnapshot(committed), { force: true });
      clearDraftFileOperation(slotKey, generation);
    },
    [
      buildDraftSourceSnapshot,
      clearDraftFileOperation,
      commitItems,
      copy.fileOperationFailed,
      enqueueDraftSave,
      isSubmitting,
      setDraftFileOperation,
    ],
  );

  const handleRemoveItem = useCallback(
    async (index: number) => {
      if (isSubmitting || finalizationRetryContextRef.current) return;
      const item = itemsRef.current[index];
      if (!item) return;
      const clientItemId = item.clientItemId;
      const currentDraftId = draftIdRef.current;
      const cleanupTargets = collectVirtualStagingItemCleanupTargets(
        uploadedDraftFilesRef.current,
        draftFileOperationsRef.current,
        clientItemId,
      );

      if (cleanupTargets.length === 0) {
        const nextItems = commitItems((current) =>
          current.filter((candidate) => candidate.clientItemId !== clientItemId),
        );
        void enqueueDraftSave(buildDraftSourceSnapshot(nextItems), {
          force: true,
        });
        return;
      }

      if (!currentDraftId) return;

      const slotKeys = Array.from(
        new Set(cleanupTargets.map((target) => target.slotKey)),
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

      const generationBySlot = new Map<string, number>();
      for (const slotKey of slotKeys) {
        const generation = nextVirtualStagingDraftFileOperationGeneration(
          draftFileOperationsRef.current[slotKey],
        );
        generationBySlot.set(slotKey, generation);
        setDraftFileOperation(slotKey, {
          status: "deleting",
          generation,
          error: null,
          pendingFileId:
            draftFileOperationsRef.current[slotKey]?.pendingFileId ?? null,
        });
      }

      const controller = new AbortController();
      const controllerKey = `remove:${clientItemId}`;
      const sessionAtStart = draftSessionRef.current;
      draftFileAbortControllersRef.current.set(controllerKey, controller);
      let remainingTargets = cleanupTargets;
      let hadFailure = false;

      const shouldApplyTargetResult = (
        target: VirtualStagingDraftFileCleanupTarget,
      ): boolean => {
        const generation = generationBySlot.get(target.slotKey);
        return (
          generation !== undefined &&
          mountedRef.current &&
          shouldApplyVirtualStagingItemRemovalResult(
            {
              draftSession: sessionAtStart,
              generation,
            },
            draftSessionRef.current,
            draftFileOperationsRef.current[target.slotKey]?.generation,
          )
        );
      };

      try {
        for (const target of cleanupTargets) {
          if (!shouldApplyTargetResult(target)) return;

          const result = await deleteOrderDraftFile(
            currentDraftId,
            target.id,
            controller.signal,
          );
          if (!shouldApplyTargetResult(target)) return;

          const reconciled =
            result.ok ||
            isTrustedVirtualStagingCleanupAlreadyAbsent(result.code);

          if (!reconciled) {
            hadFailure = true;
            const generation = generationBySlot.get(target.slotKey);
            if (generation !== undefined) {
              setDraftFileOperation(target.slotKey, {
                status: "error",
                generation,
                error: copy.itemFilesCouldNotDelete,
                pendingFileId:
                  draftFileOperationsRef.current[target.slotKey]
                    ?.pendingFileId ?? null,
              });
            }
            continue;
          }

          remainingTargets =
            removeVirtualStagingCleanupTargetFromRetrySet(
              remainingTargets,
              target.id,
            );
          commitUploadedDraftFiles((prev) =>
            target.source === "uploaded"
              ? removeVirtualStagingUploadedFileSummary(
                  prev,
                  target.clientItemId,
                  target.kind,
                )
              : prev,
          );
          commitItems((current) =>
            current.map((candidate) =>
              candidate.clientItemId === target.clientItemId
                ? clearStagingItemDraftFileSlot(candidate, target.kind)
                : candidate,
            ),
          );

          const generation = generationBySlot.get(target.slotKey);
          if (generation === undefined) continue;
          const nextOperations = clearVirtualStagingCleanupPendingTarget(
            draftFileOperationsRef.current,
            target,
            generation,
          );
          draftFileOperationsRef.current = nextOperations;
          setDraftFileOperations(nextOperations);

          if (
            !remainingTargets.some(
              (candidate) => candidate.slotKey === target.slotKey,
            )
          ) {
            clearDraftFileOperation(target.slotKey, generation);
          }
        }

        if (!mountedRef.current) return;
        if (hadFailure) {
          setDraftError(copy.itemFilesCouldNotDelete);
          void enqueueDraftSave(buildDraftSourceSnapshot(itemsRef.current), {
            force: true,
          });
          return;
        }

        if (shouldFinishVirtualStagingItemRemoval(remainingTargets)) {
          const nextItems = commitItems((current) =>
            current.filter(
              (candidate) => candidate.clientItemId !== clientItemId,
            ),
          );
          for (const slotKey of slotKeys) {
            const generation = generationBySlot.get(slotKey);
            if (generation !== undefined) {
              clearDraftFileOperation(slotKey, generation);
            }
          }
          void enqueueDraftSave(buildDraftSourceSnapshot(nextItems), {
            force: true,
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!mountedRef.current) return;
        setDraftError(copy.itemFilesCouldNotDelete);
        for (const slotKey of slotKeys) {
          const generation = generationBySlot.get(slotKey);
          if (generation === undefined) continue;
          if (
            shouldApplyVirtualStagingDraftFileOperationResult(
              {
                draftSession: sessionAtStart,
                generation,
              },
              draftSessionRef.current,
              draftFileOperationsRef.current[slotKey]?.generation,
            )
          ) {
            setDraftFileOperation(slotKey, {
              status: "error",
              generation,
              error: copy.itemFilesCouldNotDelete,
              pendingFileId:
                draftFileOperationsRef.current[slotKey]?.pendingFileId ?? null,
            });
          }
        }
      } finally {
        if (
          draftFileAbortControllersRef.current.get(controllerKey) === controller
        ) {
          draftFileAbortControllersRef.current.delete(controllerKey);
        }
      }
    },
    [
      buildDraftSourceSnapshot,
      clearDraftFileOperation,
      commitItems,
      commitUploadedDraftFiles,
      copy.itemFilesCouldNotDelete,
      enqueueDraftSave,
      isSubmitting,
      setDraftFileOperation,
    ],
  );

  useEffect(() => {
    if (requestedDraftId) {
      if (
        shouldPreserveVirtualStagingSupportRecommendationForDraft({
          requestedDraftId,
          currentDraftId: draftIdRef.current,
          supportRecommendationApplied: supportRecommendationAppliedRef.current,
        })
      ) {
        window.queueMicrotask(() => setSupportPrefillReady(true));
        return;
      }

      const storage = getSupportOrderPrefillStorage(window);
      if (storage) {
        consumeSupportOrderPrefill(storage, "virtual-staging");
      }
      supportRecommendedAddOnIdsRef.current = [];
      supportRecommendationAppliedRef.current = false;
      window.queueMicrotask(() => {
        setSupportRecommendationNoticeVisible(false);
        setSupportPrefillReady(true);
      });
      return;
    }

    const storage = getSupportOrderPrefillStorage(window);
    const prefill = storage
      ? consumeSupportOrderPrefill(storage, "virtual-staging")
      : null;
    if (!prefill) {
      supportRecommendationAppliedRef.current = false;
      window.queueMicrotask(() => setSupportPrefillReady(true));
      return;
    }

    supportRecommendedAddOnIdsRef.current = [...prefill.addOnIds];
    supportRecommendationAppliedRef.current = true;
    window.queueMicrotask(() => {
      commitItems((current) => {
        const firstItem = current[0] ?? emptyStagingItem();
        return [
          applyVirtualStagingInitialAddOns(firstItem, prefill.addOnIds),
          ...current.slice(1),
        ];
      });
      setSupportRecommendationNoticeVisible(true);
      setSupportPrefillReady(true);
    });
  }, [commitItems, requestedDraftId]);

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
            const statusResult =
              await getVirtualStagingDraftFinalizationStatus(
                requestedDraftId,
                controller.signal,
              );
            if (
              !shouldApplyVirtualStagingSaveResult(
                sessionAtStart,
                draftSessionRef.current,
              )
            ) {
              return;
            }
            if (!statusResult.ok) {
              if (statusResult.status === 401) {
                setResumeState("error");
                setDraftError(copy.signInAgain);
                return;
              }
              setResumeState("error");
              setDraftError(statusResult.message || copy.restoreFailed);
              return;
            }
            if (statusResult.data.status === "active") {
              const restoredResult = await getOrderDraft(
                requestedDraftId,
                controller.signal,
              );
              if (
                !shouldApplyVirtualStagingSaveResult(
                  sessionAtStart,
                  draftSessionRef.current,
                )
              ) {
                return;
              }
              if (restoredResult.ok) {
                await applyRestoredDraft(
                  restoredResult.data,
                  sessionAtStart,
                  controller.signal,
                );
                return;
              }
            }
            applyFinalizationStatus(statusResult.data);
            return;
          }
          setResumeState("error");
          setDraftError(result.message);
          return;
        }

        await applyRestoredDraft(
          result.data,
          sessionAtStart,
          controller.signal,
        );
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
  }, [
    applyFinalizationStatus,
    applyRestoredDraft,
    copy,
    requestedDraftId,
  ]);

  useEffect(() => {
    if (
      finalizationRetryContext !== null ||
      resumeState !== "ready" ||
      !supportPrefillReady ||
      !hasMeaningfulDraft ||
      !shouldAllowVirtualStagingSupportPrefillAutosave({
        currentDraftId: draftId,
        source: draftSource,
        recommendedAddOnIds: supportRecommendedAddOnIdsRef.current,
        supportRecommendationApplied: supportRecommendationAppliedRef.current,
      }) ||
      saveStatus === "conflict"
    ) {
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void saveDraftNow();
    }, 1800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    draftId,
    draftSource,
    finalizationRetryContext,
    hasMeaningfulDraft,
    resumeState,
    saveDraftNow,
    saveStatus,
    supportPrefillReady,
  ]);

  const handleReloadLatestDraft = async () => {
    if (finalizationRetryContextRef.current) return;
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
    let restoredItems = resume.form.items;
    const restoredReferences = await listDraftReferenceFiles(result.data.id);
    if (restoredReferences.ok) {
      restoredItems = restoredItems.map((item) => ({
        ...item,
        referenceFiles: restoredReferences.data.filter(
          (reference) => reference.itemClientId === item.clientItemId,
        ),
      }));
    }
    commitItems(restoredItems);
    setJobTitle(resume.form.jobTitle);
    setDefaultFurnitureStyle(resume.form.defaultFurnitureStyle);
    setPendingGlobalStyle(null);
    setOrderTerms(resume.form.orderTerms);
    const restoredRegion = resolveVirtualStagingDraftRegion(result.data);
    const restoredCurrency = currencyForRegion(restoredRegion);
    setRegion(restoredRegion);
    setDraftVersion(resume.version);
    draftVersionRef.current = resume.version;
    savedFingerprintRef.current = buildVirtualStagingDraftFingerprint({
      jobTitle: resume.form.jobTitle,
      defaultFurnitureStyle: resume.form.defaultFurnitureStyle,
      items: restoredItems,
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
    if (finalizationRetryContextRef.current) return;
    const currentDraftId = draftIdRef.current;
    if (!currentDraftId) return;
    await refreshUploadedDraftFiles(
      currentDraftId,
      draftSessionRef.current,
    );
  };

  const handleFinalizationStatusRecheck = async () => {
    if (!finalizationRecovery || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError("");
    const sessionAtStart = draftSessionRef.current;

    try {
      const result = await getVirtualStagingDraftFinalizationStatus(
        finalizationRecovery.draftId,
      );
      if (
        !mountedRef.current ||
        !shouldApplyVirtualStagingSaveResult(
          sessionAtStart,
          draftSessionRef.current,
        )
      ) {
        return;
      }
      if (!result.ok) {
        setSubmitError(result.message || copy.restoreFailed);
        return;
      }
      applyFinalizationStatus(result.data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (!mountedRef.current) return;
      setSubmitError(copy.restoreFailed);
    } finally {
      if (mountedRef.current) setIsSubmitting(false);
    }
  };

  const handleFinishFinalizationRecovery = async () => {
    if (
      !finalizationRecovery ||
      finalizationRecovery.status !== "reconciliation_required" ||
      isSubmitting
    ) {
      return;
    }

    const sessionAtStart = draftSessionRef.current;
    const storedContext =
      finalizationRetryContextRef.current?.draftId ===
      finalizationRecovery.draftId
        ? finalizationRetryContextRef.current
        : readStoredFinalizationRetryContext(finalizationRecovery.draftId);
    const recoveredFinalizationKey =
      storedContext?.finalizationKey ?? createFinalizationKey();
    const retryContext: FinalizationRetryContext = {
      draftId: finalizationRecovery.draftId,
      expectedVersion: finalizationRecovery.expectedVersion,
      finalizationKey: recoveredFinalizationKey,
    };

    finalizationKeyRef.current = recoveredFinalizationKey;
    setFinalizationKey(recoveredFinalizationKey);
    storeFinalizationRetryContext(retryContext);
    setIsSubmitting(true);
    setSubmitError("");

    const result = await submitVirtualStagingDraft(
      retryContext.draftId,
      retryContext.expectedVersion,
      retryContext.finalizationKey,
    );
    applyDraftFinalizationResult(result, retryContext, sessionAtStart);
  };

  const submitCurrentLocalOrder = async (
    currentItems: StagingItemData[],
  ): Promise<OrderSubmitResult> => {
    const missingLocalOriginalIndex = currentItems.findIndex(
      (item) => item.file === null,
    );
    if (missingLocalOriginalIndex >= 0) {
      return {
        success: false,
        error:
          "Some images exist only in the saved draft. Retry the draft upload or reselect the required originals before submitting.",
        errorCode: "validation-failed",
      };
    }

    const itemsMetadata = currentItems.map((item) => ({
      roomName: item.roomName,
      furnitureStyle: item.furnitureStyle,
      fileSizeLimit: item.fileSizeLimit,
      disclaimerText: item.disclaimerText,
      referenceLink: item.referenceLink,
      additionalInfo: item.additionalInfo,
      selectedAddons: item.selectedAddons,
    }));

    const currentDraftId = draftIdRef.current;
    const listedReferences = currentDraftId
      ? await listDraftReferenceFiles(currentDraftId)
      : null;
    if (listedReferences && !listedReferences.ok) {
      return {
        success: false,
        error: listedReferences.message,
        errorCode: "server-error",
      };
    }
    const files = await Promise.all(currentItems.map(async (item) => {
      const references = listedReferences?.ok
        ? listedReferences.data.filter(
            (reference) => reference.itemClientId === item.clientItemId,
          )
        : item.referenceFiles;
      const referenceFiles = await Promise.all(references.map(async (reference) => {
        if (reference.file) return reference.file;
        if (!reference.previewUrl) {
          throw new Error(`Saved reference ${reference.filename} could not be loaded.`);
        }
        const response = await fetch(reference.previewUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Saved reference ${reference.filename} could not be loaded.`);
        }
        return new File([await response.blob()], reference.filename, {
          type: reference.mimeType,
          lastModified: Date.now(),
        });
      }));
      if (referenceFiles.length === 0 && item.referenceFile) {
        referenceFiles.push(item.referenceFile);
      }
      return { file: item.file, referenceFiles };
    }));

    return submitOrder(
      "virtual-staging",
      itemsMetadata,
      files,
      orderTerms,
      jobTitle,
    );
  };

  const retireSubmittedDraftBestEffort = async (
    submittedDraftId: string,
    expectedVersion: number,
  ) => {
    try {
      const response = await fetch(
        `/api/order-drafts/${encodeURIComponent(submittedDraftId)}`,
        {
          method: "DELETE",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedVersion }),
        },
      );
      if (!response.ok) {
        console.warn(
          "[virtual-staging] submitted local-fallback draft was not retired",
          response.status,
        );
      }
    } catch (error) {
      console.warn(
        "[virtual-staging] submitted local-fallback draft retirement failed",
        error,
      );
    }
  };

  const applyDraftFinalizationResult = (
    result: DraftFinalizationClientResult,
    retryContext: FinalizationRetryContext,
    sessionAtStart: number,
  ): boolean => {
    if (
      !mountedRef.current ||
      !shouldApplyVirtualStagingFinalizationResult({
        startedSession: sessionAtStart,
        currentSession: draftSessionRef.current,
        startedKey: retryContext.finalizationKey,
        currentKey: finalizationKeyRef.current,
      })
    ) {
      return false;
    }

    if (result.ok) {
      submissionInFlightRef.current = false;
      setOrderNumber(result.data.orderNumber);
      setConfirmationEmailSent(result.data.confirmationEmailSent === true);
      setSubmitted(true);
      setFinalizationRecovery(null);
      setFinalizationKey(null);
      finalizationKeyRef.current = null;
      clearFinalizationRetryContext();
      setIsSubmitting(false);
      return true;
    }

    const shouldPreserveKey =
      shouldPreserveVirtualStagingFinalizationKeyAfterFailure({
        code: result.code,
        status: result.status,
      });

    if (shouldPreserveKey) {
      finalizationKeyRef.current = retryContext.finalizationKey;
      setFinalizationKey(retryContext.finalizationKey);
      storeFinalizationRetryContext(retryContext);
    } else {
      setFinalizationKey(null);
      finalizationKeyRef.current = null;
      clearFinalizationRetryContext();
    }

    if (
      result.code === "unauthenticated" &&
      redirectOnOrderAuthError(
        {
          success: false,
          error: result.message,
          errorCode: "unauthorized",
        },
        orderRoute,
      )
    ) {
      submissionInFlightRef.current = false;
      return true;
    }
    if (
      result.code === "profile_incomplete" &&
      redirectOnOrderAuthError(
        {
          success: false,
          error: result.message,
          errorCode: "profile-incomplete",
        },
        orderRoute,
      )
    ) {
      submissionInFlightRef.current = false;
      return true;
    }

    submissionInFlightRef.current = false;
    setIsSubmitting(false);
    setSubmitError(result.message || "Submission failed. Please try again.");
    return true;
  };

  const goToReview = () => {
    if (
      isSubmitting ||
      hasActiveDraftFileOperation ||
      finalizationRetryContextRef.current
    ) {
      return;
    }

    setSubmitError("");
    if (configurationMissingRequiredFields.length > 0) {
      setValidationAttempted(true);
      focusRequiredField(configurationMissingRequiredFields[0].targetId);
      return;
    }

    setValidationAttempted(false);
    pendingScrollRef.current = { type: "top" };
    setStep("review");
  };

  const goToConfigureTop = () => {
    if (isSubmitting || finalizationRetryContextRef.current) return;
    pendingScrollRef.current = { type: "top" };
    setStep("configure");
  };

  const handleEditItem = (index: number) => {
    if (isSubmitting || finalizationRetryContextRef.current) return;
    const item = itemsRef.current[index];
    if (!item) return;
    pendingScrollRef.current = { type: "item", clientItemId: item.clientItemId };
    setStep("configure");
  };

  const handleSubmit = async () => {
    if (
      step !== "review" ||
      submissionInFlightRef.current ||
      isSubmitting ||
      hasActiveDraftFileOperation
    ) {
      return;
    }
    const sessionAtStart = draftSessionRef.current;
    setSubmitError("");

    const retryContext = finalizationRetryContextRef.current;
    if (retryContext) {
      submissionInFlightRef.current = true;
      setIsSubmitting(true);
      finalizationKeyRef.current = retryContext.finalizationKey;
      setFinalizationKey(retryContext.finalizationKey);
      const result = await submitVirtualStagingDraft(
        retryContext.draftId,
        retryContext.expectedVersion,
        retryContext.finalizationKey,
      );
      applyDraftFinalizationResult(result, retryContext, sessionAtStart);
      return;
    }

    if (missingRequiredFields.length > 0) {
      setValidationAttempted(true);
      focusRequiredField(missingRequiredFields[0].targetId);
      return;
    }

    setValidationAttempted(false);
    submissionInFlightRef.current = true;
    setIsSubmitting(true);
    const saveOutcome = await enqueueDraftSave(buildDraftSourceSnapshot(), {
      force: true,
    });
    if (
      !mountedRef.current ||
      !shouldApplyVirtualStagingSaveResult(
        sessionAtStart,
        draftSessionRef.current,
      )
    ) {
      return;
    }
    if (!saveOutcome.ok) {
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
      setSubmitError("Please save the draft before submitting.");
      return;
    }

    await refreshUploadedDraftFiles(saveOutcome.draftId, sessionAtStart);
    if (
      !mountedRef.current ||
      !shouldApplyVirtualStagingSaveResult(
        sessionAtStart,
        draftSessionRef.current,
      )
    ) {
      return;
    }

    const currentItems = itemsRef.current;
    const uploadedFiles = uploadedDraftFilesRef.current;
    const decision = selectVirtualStagingDraftSubmissionMode(
      currentItems.map((item) => ({
        localOriginal: item.file,
        localReference: item.referenceFile,
        uploadedOriginal: getVirtualStagingUploadedFileForSlot(
          uploadedFiles,
          item.clientItemId,
          "original",
        ),
        uploadedReference: getVirtualStagingUploadedFileForSlot(
          uploadedFiles,
          item.clientItemId,
          "reference",
        ),
      })),
    );

    if (decision.mode === "not_ready") {
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
      setSubmitError("Please add an original image for every item.");
      return;
    }

    if (decision.mode === "local_upload_fallback_unavailable") {
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
      setSubmitError(
        "A current file change is not saved to the draft, but another item only has a saved draft image. Retry the failed draft upload or reselect the required originals before submitting.",
      );
      return;
    }

    if (decision.mode === "local_upload_fallback") {
      finalizationKeyRef.current = null;
      setFinalizationKey(null);
      clearFinalizationRetryContext();
      const result = await submitCurrentLocalOrder(currentItems);
      if (result.success && result.orderNumber) {
        await retireSubmittedDraftBestEffort(
          saveOutcome.draftId,
          saveOutcome.version,
        );
        if (
          !mountedRef.current ||
          !shouldApplyVirtualStagingSaveResult(
            sessionAtStart,
            draftSessionRef.current,
          )
        ) {
          return;
        }
        setOrderNumber(result.orderNumber);
        setConfirmationEmailSent(result.confirmationEmailSent === true);
        setSubmitted(true);
        submissionInFlightRef.current = false;
        setIsSubmitting(false);
        return;
      }
      if (redirectOnOrderAuthError(result, orderRoute)) {
        submissionInFlightRef.current = false;
        return;
      }
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
      setSubmitError(result.error || "Submission failed. Please try again.");
      return;
    }

    const key = finalizationKeyRef.current ?? createFinalizationKey();
    finalizationKeyRef.current = key;
    setFinalizationKey(key);
    const nextRetryContext = {
      draftId: saveOutcome.draftId,
      expectedVersion: saveOutcome.version,
      finalizationKey: key,
    };

    const result = await submitVirtualStagingDraft(
      nextRetryContext.draftId,
      nextRetryContext.expectedVersion,
      nextRetryContext.finalizationKey,
    );
    applyDraftFinalizationResult(result, nextRetryContext, sessionAtStart);
  };

  const handleNewOrder = startNewVirtualStagingOrder;

  const hasFinalizationRetryContext = finalizationRetryContext !== null;
  const isReview = step === "review";
  const canReview =
    !hasActiveDraftFileOperation &&
    !isSubmitting &&
    !hasFinalizationRetryContext;
  const canSubmit =
    isReview &&
    !hasActiveDraftFileOperation &&
    !isSubmitting &&
    (hasFinalizationRetryContext || missingRequiredFields.length === 0);
  const pendingOverrideCount = pendingGlobalStyle
    ? countIndividualFurnitureStyles(items, defaultFurnitureStyle)
    : 0;

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

  if (resumeState === "finalization_recovery" && finalizationRecovery) {
    const canFinish =
      finalizationRecovery.status === "reconciliation_required";
    const recoveryTitle = canFinish
      ? copy.finalizationRecoveryTitle
      : copy.finalizationInProgressTitle;
    const recoveryMessage = canFinish
      ? copy.finalizationRecoveryMessage
      : copy.finalizationInProgressMessage;
    const recoveryOrderNumber =
      finalizationRecovery.status === "reconciliation_required"
        ? finalizationRecovery.orderNumber
        : null;

    return (
      <section className="py-16 bg-surface min-h-screen">
        <Container>
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Virtual Staging
            </p>
            <h1 className="mt-2 text-xl font-semibold text-foreground">
              {recoveryTitle}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              {recoveryMessage}
            </p>
            {recoveryOrderNumber && (
              <p className="mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground">
                {copy.existingOrder}: {recoveryOrderNumber}
              </p>
            )}
            {submitError && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                {submitError}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={
                  canFinish
                    ? handleFinishFinalizationRecovery
                    : handleFinalizationStatusRecheck
                }
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {isSubmitting
                  ? copy.creatingOrder
                  : canFinish
                    ? copy.finishOrderCreation
                    : copy.checkAgain}
              </button>
              <button
                type="button"
                onClick={startNewVirtualStagingOrder}
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {copy.startNew}
              </button>
            </div>
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
      header={<OrderStepIndicator steps={STEPS} currentStepId={step} />}
      sidebar={
        isReview ? (
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
            submitLabel={
              hasFinalizationRetryContext
                ? copy.retryOrderFinalization
                : undefined
            }
            submittingLabel={
              hasFinalizationRetryContext
                ? copy.retryOrderFinalization
                : copy.creatingOrder
            }
            submitHelper={
              hasActiveDraftFileOperation ? (
                <p role="status">{copy.waitForImages}</p>
              ) : missingRequiredFields.length > 0 ? (
                <p role="status">{copy.termsRequired}</p>
              ) : null
            }
          />
        ) : (
          <OrderSummary
            serviceName="Virtual Staging"
            items={summaryItems}
            pricingInput={{
              serviceType: "virtual-staging",
              items: items.map((item) => ({
                selectedAddons: item.selectedAddons,
              })),
            }}
            onSubmit={goToReview}
            isSubmitting={false}
            canSubmit={canReview}
            submitLabel="Review Order"
            footerNote="No payment now. You'll confirm your order on the next step."
            submitHelper={
              hasActiveDraftFileOperation ? (
                <p role="status">{copy.waitForImages}</p>
              ) : validationAttempted &&
                configurationMissingRequiredFields.length > 0 ? (
                <div aria-live="polite">
                  <p className="font-medium text-foreground">
                    {copy.incompleteFields(
                      configurationMissingRequiredFields.length,
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-1 gap-y-0.5">
                    {configurationMissingRequiredFields.map((field, index) => (
                      <span key={`${field.kind}-${field.clientItemId ?? "order"}`}>
                        {index > 0 && (
                          <span className="mr-1" aria-hidden>
                            {"\u00b7"}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => focusRequiredField(field.targetId)}
                          className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:text-primary-light"
                        >
                          {field.summaryLabel}
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null
            }
          />
        )
      }
    >
      {isReview ? (
        <VirtualStagingReview
          jobTitle={jobTitle}
          items={items}
          uploadedFilesBySlot={uploadedFilesBySlot}
          orderTerms={orderTerms}
          onTermsChange={setOrderTerms}
          onEditItem={handleEditItem}
          onBack={goToConfigureTop}
          submitError={submitError}
          termsContainerId={TERMS_REQUIRED_FIELD_ID}
          disabled={hasFinalizationRetryContext || isSubmitting}
        />
      ) : (
        <>
      {saveStatus === "saving" && (
        <p role="status" className="text-xs font-medium text-muted">
          {copy.saving}
        </p>
      )}

      {draftError && saveStatus !== "conflict" && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            {saveStatus === "save_failed" ? `${copy.save_failed}: ` : ""}
            {draftError}
          </p>
          {saveStatus === "save_failed" && (
            <button
              type="button"
              onClick={() => void saveDraftNow({ force: true })}
              disabled={isSubmitting || hasActiveDraftFileOperation}
              className="inline-flex w-full items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {copy.retry}
            </button>
          )}
        </div>
      )}

      {draftFilesWarning && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p>{draftFilesWarning}</p>
          <button
            type="button"
            onClick={handleRetryDraftFiles}
            disabled={hasFinalizationRetryContext}
            className="inline-flex w-full items-center justify-center rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
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

      {supportRecommendationNoticeVisible && (
        <div
          role="region"
          aria-live="polite"
          aria-labelledby={supportRecommendationTitleId}
          className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0">
            <h2
              id={supportRecommendationTitleId}
              className="text-sm font-semibold text-foreground"
            >
              {copy.supportRecommendationTitle}
            </h2>
            <p className="mt-1 text-muted">
              {copy.supportRecommendationMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSupportRecommendationNoticeVisible(false)}
            className="inline-flex w-full items-center justify-center rounded-lg border border-primary/20 bg-white px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/30 sm:w-auto"
          >
            {copy.supportRecommendationDismiss}
          </button>
        </div>
      )}

      <OrderJobTitleField
        value={jobTitle}
        onChange={setJobTitle}
        showError={validationAttempted}
        containerId={JOB_TITLE_REQUIRED_FIELD_ID}
        errorMessage={copy.jobTitleRequired}
        disabled={hasFinalizationRetryContext || isSubmitting}
      />

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
        <h2
          id={globalStyleLabelId}
          className="text-sm font-semibold text-foreground"
        >
          Furniture Style for Entire Order{" "}
          <span className="text-red-500">*</span>
        </h2>
        <p
          id={globalStyleHelperId}
          className="mb-4 mt-1 text-xs leading-5 text-muted"
        >
          Select a default style for all images. You can override it for an
          individual image below.
        </p>
        <StyleSelector
          value={defaultFurnitureStyle}
          onChange={handleGlobalStyleChange}
          mediaByKey={exampleMediaByKey}
          groupName="virtual-staging-order-style"
          ariaLabelledBy={globalStyleLabelId}
          ariaDescribedBy={globalStyleHelperId}
          disabled={hasFinalizationRetryContext || isSubmitting}
        />
      </section>

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
          const validationErrors: Partial<
            Record<StagingRequiredField, string>
          > = {};
          if (validationAttempted) {
            for (const field of configurationMissingRequiredFields) {
              if (
                field.clientItemId === item.clientItemId &&
                field.kind !== "job-title" &&
                field.kind !== "terms"
              ) {
                validationErrors[field.kind] = field.message;
              }
            }
          }

          return (
            <StagingItemCard
              key={item.clientItemId}
              index={index}
              data={item}
              defaultFurnitureStyle={defaultFurnitureStyle}
              exampleMediaByKey={exampleMediaByKey}
              onChange={(data) => handleItemChange(index, data)}
              onReferenceFilesChange={(referenceFiles) =>
                void handleReferenceFilesChange(index, referenceFiles)
              }
              onRemove={() => void handleRemoveItem(index)}
              canRemove={items.length > 1}
              removeDisabled={
                hasFinalizationRetryContext ||
                isSubmitting ||
                isVirtualStagingDraftFileSlotOperationActive(
                  originalOperation,
                ) ||
                isVirtualStagingDraftFileSlotOperationActive(
                  referenceOperation,
                )
              }
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
              originalBusy={
                hasFinalizationRetryContext ||
                isSubmitting ||
                isVirtualStagingDraftFileSlotOperationActive(originalOperation)
              }
              referenceBusy={
                hasFinalizationRetryContext ||
                isSubmitting ||
                isVirtualStagingDraftFileSlotOperationActive(referenceOperation)
              }
              disabled={hasFinalizationRetryContext || isSubmitting}
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
              validationErrors={validationErrors}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleAddItem}
        disabled={hasFinalizationRetryContext || isSubmitting}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted hover:text-primary hover:border-primary/40 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
        Add Another Image
      </button>
        </>
      )}
      <ApplyStyleConfirmationDialog
        open={pendingGlobalStyle !== null}
        overrideCount={pendingOverrideCount}
        onCancel={() => setPendingGlobalStyle(null)}
        onConfirm={confirmGlobalStyleChange}
        disabled={isSubmitting || hasFinalizationRetryContext}
      />
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

function createFinalizationKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readStoredFinalizationRetryContext(
  draftId: string,
): FinalizationRetryContext | null {
  if (typeof window === "undefined") return null;
  try {
    const key = buildVirtualStagingFinalizationRetryStorageKey(draftId);
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = parseVirtualStagingFinalizationRetryContext(raw, draftId);
    if (!parsed) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredFinalizationRetryContext(
  context: FinalizationRetryContext,
): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      buildVirtualStagingFinalizationRetryStorageKey(context.draftId),
      serializeVirtualStagingFinalizationRetryContext(context),
    );
  } catch {
    // Session storage is a convenience only; server status remains authoritative.
  }
}

function removeStoredFinalizationRetryContext(draftId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(
      buildVirtualStagingFinalizationRetryStorageKey(draftId),
    );
  } catch {
    // Session storage is a convenience only; server status remains authoritative.
  }
}

function clearStagingItemDraftFileSlot(
  item: StagingItemData,
  kind: VirtualStagingDraftFileSlotKind,
): StagingItemData {
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
