"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Info, Plus } from "lucide-react";
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
import RenovationItemCard, {
  type RenovationItemData,
  emptyRenovationItem,
} from "@/components/order/virtual-renovation/RenovationItemCard";
import { useDisplayRegion } from "@/components/pricing/currency-client";
import Container from "@/components/layout/Container";
import { currencyForRegion } from "@/lib/currency";
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
import {
  getOrderDraftFinalizationStatus,
  submitOrderDraft,
  type DraftFinalizationClientResult,
} from "@/lib/order-drafts/finalization-client";
import {
  buildOrderDraftFinalizationRetryStorageKey,
  parseDraftFinalizationRetryContext,
  serializeDraftFinalizationRetryContext,
  shouldPreserveDraftFinalizationKeyAfterFailure,
  type DraftFinalizationRetryContext,
  type DraftFinalizationStatusDto,
} from "@/lib/order-drafts/finalization";
import {
  buildVirtualRenovationCreateDraftInput,
  buildVirtualRenovationDraftFingerprint,
  buildVirtualRenovationUpdateDraftInput,
  hasMeaningfulVirtualRenovationDraftChange,
  resetVirtualRenovationDraftIdentity,
  resolveVirtualRenovationDraftRegion,
  shouldApplyVirtualRenovationAsyncResult,
  validateVirtualRenovationDraftForResume,
  type VirtualRenovationAutosaveStatus,
  type VirtualRenovationFormDraftSource,
} from "@/lib/order-drafts/virtual-renovation";
import { UuidSchema } from "@/lib/order-drafts/schema";

interface VirtualRenovationOrderFormProps {
  clientEmail: string;
  orderRoute: string;
}

interface DraftSaveOutcome {
  draftId: string;
  version: number;
}

type ResumeState = "loading" | "ready" | "error" | "finalization_recovery";
type FileOperationPhase =
  | "saving"
  | "preparing"
  | "uploading"
  | "verifying"
  | "removing"
  | "error";

interface FileOperation {
  generation: number;
  phase: FileOperationPhase;
  message: string;
  error: string;
  pendingFileId: string | null;
  retryFile: File | null;
  retryRemove: boolean;
}

type FinalizationRecovery =
  | {
      status: "finalization_in_progress";
      draftId: string;
      expectedVersion: number;
    }
  | {
      status: "reconciliation_required";
      draftId: string;
      expectedVersion: number;
      orderId: string;
      orderNumber: string;
    };

const AUTOSAVE_DELAY_MS = 900;

function fileSlotKey(
  clientItemId: string,
  kind: "original" | "reference",
): string {
  return `${clientItemId}:${kind}`;
}

export default function VirtualRenovationOrderForm({
  clientEmail,
  orderRoute,
}: VirtualRenovationOrderFormProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedDraftId = searchParams.get("draft");
  const requestedDraftIsValid =
    !requestedDraftId || UuidSchema.safeParse(requestedDraftId).success;
  const [region, setRegion] = useDisplayRegion();
  const currency = currencyForRegion(region);

  const [items, setItems] = useState<RenovationItemData[]>([
    emptyRenovationItem(),
  ]);
  const [jobTitle, setJobTitle] = useState("");
  const [orderTerms, setOrderTerms] = useState<OrderTermsData>(emptyOrderTerms);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [draftId, setDraftId] = useState<string | null>(() =>
    requestedDraftId && requestedDraftIsValid ? requestedDraftId : null,
  );
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] =
    useState<VirtualRenovationAutosaveStatus>("not_saved");
  const [draftError, setDraftError] = useState(() =>
    requestedDraftIsValid ? "" : "Draft link is invalid.",
  );
  const [resumeState, setResumeState] = useState<ResumeState>(
    requestedDraftId
      ? requestedDraftIsValid
        ? "loading"
        : "error"
      : "ready",
  );
  const [uploadedDraftFiles, setUploadedDraftFiles] = useState<
    OrderDraftUploadedFileSummary[]
  >([]);
  const [fileOperations, setFileOperations] = useState<
    Record<string, FileOperation>
  >({});
  const [finalizationRecovery, setFinalizationRecovery] =
    useState<FinalizationRecovery | null>(null);
  const [finalizationRetryContext, setFinalizationRetryContext] =
    useState<DraftFinalizationRetryContext | null>(null);

  const itemsRef = useRef(items);
  const jobTitleRef = useRef(jobTitle);
  const orderTermsRef = useRef(orderTerms);
  const draftIdRef = useRef(draftId);
  const draftVersionRef = useRef(draftVersion);
  const uploadedDraftFilesRef = useRef(uploadedDraftFiles);
  const fileOperationsRef = useRef(fileOperations);
  const draftSessionRef = useRef(0);
  const savedFingerprintRef = useRef<string | null>(null);
  const failedFingerprintRef = useRef<string | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const finalizationRetryContextRef =
    useRef<DraftFinalizationRetryContext | null>(null);
  const submissionInFlightRef = useRef(false);

  const commitItems = useCallback((next: RenovationItemData[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const commitUploadedFiles = useCallback(
    (next: OrderDraftUploadedFileSummary[]) => {
      uploadedDraftFilesRef.current = next;
      setUploadedDraftFiles(next);
    },
    [],
  );

  const commitFileOperation = useCallback(
    (slotKey: string, operation: FileOperation | null) => {
      const next = { ...fileOperationsRef.current };
      if (operation) next[slotKey] = operation;
      else delete next[slotKey];
      fileOperationsRef.current = next;
      setFileOperations(next);
    },
    [],
  );

  useEffect(() => {
    jobTitleRef.current = jobTitle;
  }, [jobTitle]);

  useEffect(() => {
    orderTermsRef.current = orderTerms;
  }, [orderTerms]);

  const uploadedFilesBySlot = useMemo(() => {
    const indexed = new Map<string, OrderDraftUploadedFileSummary>();
    for (const file of uploadedDraftFiles) {
      indexed.set(fileSlotKey(file.itemClientId, file.kind), file);
    }
    return indexed;
  }, [uploadedDraftFiles]);

  const buildDraftSource = useCallback(
    (nextItems = itemsRef.current): VirtualRenovationFormDraftSource => ({
      jobTitle: jobTitleRef.current,
      items: nextItems,
      orderTerms: orderTermsRef.current,
      currency,
      region,
    }),
    [currency, region],
  );

  const replaceDraftUrl = useCallback(
    (nextSearch: string) => {
      const suffix = nextSearch ? `?${nextSearch}` : "";
      window.history.replaceState(
        null,
        "",
        `${pathname}${suffix}${window.location.hash}`,
      );
    },
    [pathname],
  );

  const setDraftQueryParam = useCallback(
    (nextDraftId: string | null) => {
      const next = new URLSearchParams(window.location.search);
      if (nextDraftId) next.set("draft", nextDraftId);
      else next.delete("draft");
      replaceDraftUrl(next.toString());
    },
    [replaceDraftUrl],
  );

  const persistDraft = useCallback(
    async (
      source: VirtualRenovationFormDraftSource,
      force: boolean,
      startedSession: number,
    ): Promise<DraftSaveOutcome | null> => {
      if (!hasMeaningfulVirtualRenovationDraftChange(source)) return null;
      const fingerprint = buildVirtualRenovationDraftFingerprint(source);
      if (!force && fingerprint === savedFingerprintRef.current) {
        const currentId = draftIdRef.current;
        const currentVersion = draftVersionRef.current;
        return currentId && currentVersion
          ? { draftId: currentId, version: currentVersion }
          : null;
      }
      if (!force && fingerprint === failedFingerprintRef.current) return null;

      setSaveStatus("saving");
      setDraftError("");
      const currentId = draftIdRef.current;
      if (!currentId) {
        const result = await createOrderDraft(
          buildVirtualRenovationCreateDraftInput(source),
        );
        if (
          !shouldApplyVirtualRenovationAsyncResult(
            startedSession,
            draftSessionRef.current,
          )
        ) {
          return null;
        }
        if (!result.ok) {
          failedFingerprintRef.current = fingerprint;
          setSaveStatus("save_failed");
          setDraftError(result.message);
          return null;
        }
        draftIdRef.current = result.data.id;
        draftVersionRef.current = result.data.version;
        setDraftId(result.data.id);
        setDraftVersion(result.data.version);
        savedFingerprintRef.current = fingerprint;
        failedFingerprintRef.current = null;
        setSaveStatus("saved");
        setDraftQueryParam(result.data.id);
        return { draftId: result.data.id, version: result.data.version };
      }

      const currentVersion = draftVersionRef.current;
      if (!currentVersion) {
        failedFingerprintRef.current = fingerprint;
        setSaveStatus("save_failed");
        setDraftError("Draft version is not ready yet.");
        return null;
      }
      const result = await updateOrderDraft(
        currentId,
        buildVirtualRenovationUpdateDraftInput(source, currentVersion),
      );
      if (
        !shouldApplyVirtualRenovationAsyncResult(
          startedSession,
          draftSessionRef.current,
        )
      ) {
        return null;
      }
      if (!result.ok) {
        failedFingerprintRef.current = fingerprint;
        if (isOrderDraftVersionConflict(result)) {
          setSaveStatus("conflict");
          setDraftError(
            "This draft changed in another tab. Reload the latest version before continuing.",
          );
        } else {
          setSaveStatus("save_failed");
          setDraftError(result.message);
        }
        return null;
      }
      draftVersionRef.current = result.data.version;
      setDraftVersion(result.data.version);
      savedFingerprintRef.current = fingerprint;
      failedFingerprintRef.current = null;
      setSaveStatus("saved");
      return { draftId: currentId, version: result.data.version };
    },
    [setDraftQueryParam],
  );

  const enqueueDraftSave = useCallback(
    (
      source = buildDraftSource(),
      force = false,
    ): Promise<DraftSaveOutcome | null> => {
      const startedSession = draftSessionRef.current;
      const operation = saveQueueRef.current.then(() =>
        persistDraft(source, force, startedSession),
      );
      saveQueueRef.current = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
    [buildDraftSource, persistDraft],
  );

  const applyFinalizationStatus = useCallback(
    (status: DraftFinalizationStatusDto) => {
      if (status.status === "already_converted") {
        removeStoredFinalizationRetryContext(status.draftId);
        finalizationRetryContextRef.current = null;
        setFinalizationRetryContext(null);
        setDraftId(status.draftId);
        draftIdRef.current = status.draftId;
        setOrderId(status.orderId);
        setOrderNumber(status.orderNumber);
        setConfirmationEmailSent(false);
        setSubmitted(true);
        setResumeState("ready");
        return;
      }
      if (status.status === "reconciliation_required") {
        setFinalizationRecovery({
          status: "reconciliation_required",
          draftId: status.draftId,
          expectedVersion: status.expectedVersion,
          orderId: status.orderId,
          orderNumber: status.orderNumber,
        });
        setDraftId(status.draftId);
        draftIdRef.current = status.draftId;
        setDraftVersion(status.expectedVersion);
        draftVersionRef.current = status.expectedVersion;
        setResumeState("finalization_recovery");
        return;
      }
      if (status.status === "finalization_in_progress") {
        const expectedVersion = status.expectedVersion ?? 1;
        setFinalizationRecovery({
          status: "finalization_in_progress",
          draftId: status.draftId,
          expectedVersion,
        });
        setDraftId(status.draftId);
        draftIdRef.current = status.draftId;
        setDraftVersion(expectedVersion);
        draftVersionRef.current = expectedVersion;
        setResumeState("finalization_recovery");
        return;
      }
      setResumeState("error");
      setDraftError("This draft could not be restored.");
    },
    [],
  );

  useEffect(() => {
    if (!requestedDraftId) return;
    if (!requestedDraftIsValid) {
      window.queueMicrotask(() => {
        setResumeState("error");
        setDraftError("Draft link is invalid.");
      });
      return;
    }
    if (
      requestedDraftId === draftIdRef.current &&
      savedFingerprintRef.current !== null
    ) {
      return;
    }

    const controller = new AbortController();
    const startedSession = ++draftSessionRef.current;
    saveQueueRef.current = Promise.resolve();
    setResumeState("loading");
    setDraftError("");

    void getOrderDraft(requestedDraftId, controller.signal).then(
      async (result) => {
        if (
          !shouldApplyVirtualRenovationAsyncResult(
            startedSession,
            draftSessionRef.current,
          )
        ) {
          return;
        }
        if (!result.ok) {
          if (result.status === 404) {
            const status = await getOrderDraftFinalizationStatus(
              requestedDraftId,
              controller.signal,
            );
            if (
              !shouldApplyVirtualRenovationAsyncResult(
                startedSession,
                draftSessionRef.current,
              )
            ) {
              return;
            }
            if (!status.ok) {
              setResumeState("error");
              setDraftError(status.message);
              return;
            }
            if (status.data.status === "active") {
              window.location.reload();
              return;
            }
            applyFinalizationStatus(status.data);
            return;
          }
          setResumeState("error");
          setDraftError(result.message);
          return;
        }

        const restored = validateVirtualRenovationDraftForResume(result.data);
        if (!restored.ok) {
          setResumeState("error");
          setDraftError(restored.message);
          return;
        }
        const restoredRegion = resolveVirtualRenovationDraftRegion(result.data);
        const files = await listOrderDraftFiles(result.data.id, controller.signal);
        if (
          !shouldApplyVirtualRenovationAsyncResult(
            startedSession,
            draftSessionRef.current,
          )
        ) {
          return;
        }
        if (!files.ok) {
          setResumeState("error");
          setDraftError(files.message);
          return;
        }

        const restoredItems = restored.form.items.map((item) => {
          const original = files.data.find(
            (file) =>
              file.itemClientId === item.clientItemId &&
              file.kind === "original",
          );
          const reference = files.data.find(
            (file) =>
              file.itemClientId === item.clientItemId &&
              file.kind === "reference",
          );
          return {
            ...item,
            originalFilename: original?.originalFilename ?? null,
            referenceFilename: reference?.originalFilename ?? null,
          } as RenovationItemData;
        });
        commitItems(restoredItems);
        setJobTitle(restored.form.jobTitle);
        jobTitleRef.current = restored.form.jobTitle;
        setOrderTerms(restored.form.orderTerms);
        orderTermsRef.current = restored.form.orderTerms;
        setRegion(restoredRegion);
        setDraftId(result.data.id);
        draftIdRef.current = result.data.id;
        setDraftVersion(restored.version);
        draftVersionRef.current = restored.version;
        commitUploadedFiles(files.data);
        savedFingerprintRef.current = buildVirtualRenovationDraftFingerprint({
          jobTitle: restored.form.jobTitle,
          items: restoredItems,
          orderTerms: restored.form.orderTerms,
          currency: result.data.currency,
          region: restoredRegion,
        });
        failedFingerprintRef.current = null;
        const storedFinalization =
          readStoredFinalizationRetryContext(result.data.id);
        finalizationRetryContextRef.current = storedFinalization;
        setFinalizationRetryContext(storedFinalization);
        setSaveStatus("saved");
        setResumeState("ready");
      },
    );

    return () => controller.abort();
  }, [
    applyFinalizationStatus,
    commitItems,
    commitUploadedFiles,
    requestedDraftId,
    requestedDraftIsValid,
    setRegion,
  ]);

  useEffect(() => {
    if (
      resumeState !== "ready" ||
      saveStatus === "conflict" ||
      submitted ||
      finalizationRetryContextRef.current
    ) {
      return;
    }
    const source = buildDraftSource(items);
    if (!hasMeaningfulVirtualRenovationDraftChange(source)) return;
    const timer = window.setTimeout(() => {
      void enqueueDraftSave(source);
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [
    buildDraftSource,
    enqueueDraftSave,
    items,
    jobTitle,
    orderTerms,
    resumeState,
    saveStatus,
    submitted,
  ]);

  const handleItemChange = (clientItemId: string, data: RenovationItemData) => {
    commitItems(
      itemsRef.current.map((item) =>
        item.clientItemId === clientItemId ? data : item,
      ),
    );
  };

  const handleAddItem = () => {
    commitItems([...itemsRef.current, emptyRenovationItem()]);
  };

  const setOperationError = useCallback(
    (
      slotKey: string,
      generation: number,
      message: string,
      retryFile: File | null,
      retryRemove = false,
      pendingFileId: string | null = null,
    ) => {
      commitFileOperation(slotKey, {
        generation,
        phase: "error",
        message: "",
        error: message,
        pendingFileId,
        retryFile,
        retryRemove,
      });
      setDraftError(message);
    },
    [commitFileOperation],
  );

  const isCurrentFileOperation = useCallback(
    (
      startedSession: number,
      slotKey: string,
      generation: number,
      clientItemId: string,
    ) =>
      shouldApplyVirtualRenovationAsyncResult(
        startedSession,
        draftSessionRef.current,
        generation,
        fileOperationsRef.current[slotKey]?.generation,
      ) &&
      itemsRef.current.some((item) => item.clientItemId === clientItemId),
    [],
  );

  const uploadDraftFile = useCallback(
    async (
      clientItemId: string,
      kind: "original" | "reference",
      file: File,
    ) => {
      const slotKey = fileSlotKey(clientItemId, kind);
      const previous = fileOperationsRef.current[slotKey];
      const generation = (previous?.generation ?? 0) + 1;
      const startedSession = draftSessionRef.current;
      const nextItems = itemsRef.current.map((item) =>
        item.clientItemId === clientItemId
          ? kind === "original"
            ? { ...item, file, originalFilename: file.name }
            : { ...item, referenceFile: file, referenceFilename: file.name }
          : item,
      );
      commitItems(nextItems);
      commitFileOperation(slotKey, {
        generation,
        phase: "saving",
        message: "Saving draft...",
        error: "",
        pendingFileId: null,
        retryFile: file,
        retryRemove: false,
      });

      const saved = await enqueueDraftSave(buildDraftSource(nextItems), true);
      if (!isCurrentFileOperation(startedSession, slotKey, generation, clientItemId)) {
        return;
      }
      if (!saved) {
        setOperationError(
          slotKey,
          generation,
          "Draft must be saved before uploading this image.",
          file,
        );
        return;
      }

      commitFileOperation(slotKey, {
        generation,
        phase: "preparing",
        message: "Preparing secure upload...",
        error: "",
        pendingFileId: null,
        retryFile: file,
        retryRemove: false,
      });
      const prepared = await prepareOrderDraftFileUpload(saved.draftId, {
        itemClientId: clientItemId,
        kind,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
      if (!isCurrentFileOperation(startedSession, slotKey, generation, clientItemId)) {
        if (prepared.ok) void deleteOrderDraftFile(saved.draftId, prepared.data.file.id);
        return;
      }
      if (!prepared.ok) {
        if (prepared.code === "version_conflict") setSaveStatus("conflict");
        setOperationError(slotKey, generation, prepared.message, file);
        return;
      }

      commitFileOperation(slotKey, {
        generation,
        phase: "uploading",
        message: "Uploading image...",
        error: "",
        pendingFileId: prepared.data.file.id,
        retryFile: file,
        retryRemove: false,
      });
      const uploaded = await uploadPreparedOrderDraftFile(prepared.data, file);
      if (!isCurrentFileOperation(startedSession, slotKey, generation, clientItemId)) {
        void deleteOrderDraftFile(saved.draftId, prepared.data.file.id);
        return;
      }
      if (!uploaded.ok) {
        setOperationError(
          slotKey,
          generation,
          uploaded.message,
          file,
          false,
          prepared.data.file.id,
        );
        return;
      }

      commitFileOperation(slotKey, {
        generation,
        phase: "verifying",
        message: "Verifying saved image...",
        error: "",
        pendingFileId: prepared.data.file.id,
        retryFile: file,
        retryRemove: false,
      });
      const completed = await completeOrderDraftFileUpload(
        saved.draftId,
        prepared.data.file.id,
      );
      if (!isCurrentFileOperation(startedSession, slotKey, generation, clientItemId)) {
        if (completed.ok) void deleteOrderDraftFile(saved.draftId, completed.data.id);
        return;
      }
      if (!completed.ok) {
        setOperationError(
          slotKey,
          generation,
          completed.message,
          file,
          false,
          prepared.data.file.id,
        );
        return;
      }

      commitUploadedFiles([
        ...uploadedDraftFilesRef.current.filter(
          (candidate) =>
            fileSlotKey(candidate.itemClientId, candidate.kind) !== slotKey,
        ),
        completed.data,
      ]);
      commitItems(
        itemsRef.current.map((item) =>
          item.clientItemId === clientItemId
            ? kind === "original"
              ? {
                  ...item,
                  file: null,
                  originalFilename: completed.data.originalFilename,
                }
              : {
                  ...item,
                  referenceFile: null,
                  referenceFilename: completed.data.originalFilename,
                }
            : item,
        ),
      );
      commitFileOperation(slotKey, null);
      setDraftError("");
    },
    [
      buildDraftSource,
      commitFileOperation,
      commitItems,
      commitUploadedFiles,
      enqueueDraftSave,
      isCurrentFileOperation,
      setOperationError,
    ],
  );

  const removePersistedFile = useCallback(
    async (
      clientItemId: string,
      kind: "original" | "reference",
    ): Promise<boolean> => {
      const slotKey = fileSlotKey(clientItemId, kind);
      const persisted = uploadedDraftFilesRef.current.find(
        (file) =>
          file.itemClientId === clientItemId &&
          file.kind === kind,
      );
      if (!persisted) return true;
      const previous = fileOperationsRef.current[slotKey];
      const generation = (previous?.generation ?? 0) + 1;
      const startedSession = draftSessionRef.current;
      const currentDraftId = draftIdRef.current;
      if (!currentDraftId) return false;

      commitFileOperation(slotKey, {
        generation,
        phase: "removing",
        message: "Removing saved image...",
        error: "",
        pendingFileId: null,
        retryFile: null,
        retryRemove: true,
      });
      const result = await deleteOrderDraftFile(currentDraftId, persisted.id);
      if (!isCurrentFileOperation(startedSession, slotKey, generation, clientItemId)) {
        return false;
      }
      if (!result.ok) {
        setOperationError(slotKey, generation, result.message, null, true);
        return false;
      }

      commitUploadedFiles(
        uploadedDraftFilesRef.current.filter((file) => file.id !== persisted.id),
      );
      commitItems(
        itemsRef.current.map((item) =>
          item.clientItemId === clientItemId
            ? kind === "original"
              ? { ...item, file: null, originalFilename: null }
              : { ...item, referenceFile: null, referenceFilename: null }
            : item,
        ),
      );
      commitFileOperation(slotKey, null);
      return true;
    },
    [
      commitFileOperation,
      commitItems,
      commitUploadedFiles,
      isCurrentFileOperation,
      setOperationError,
    ],
  );

  const cancelLocalCandidate = useCallback(
    (clientItemId: string, kind: "original" | "reference") => {
      const slotKey = fileSlotKey(clientItemId, kind);
      const operation = fileOperationsRef.current[slotKey];
      const currentDraftId = draftIdRef.current;
      if (operation?.pendingFileId && currentDraftId) {
        void deleteOrderDraftFile(currentDraftId, operation.pendingFileId);
      }
      commitFileOperation(slotKey, null);
      const persisted = uploadedDraftFilesRef.current.find(
        (file) =>
          file.itemClientId === clientItemId &&
          file.kind === kind,
      );
      const nextItems = itemsRef.current.map((item) =>
        item.clientItemId === clientItemId
          ? kind === "original"
            ? {
                ...item,
                file: null,
                originalFilename: persisted?.originalFilename ?? null,
              }
            : {
                ...item,
                referenceFile: null,
                referenceFilename: persisted?.originalFilename ?? null,
              }
          : item,
      );
      commitItems(nextItems);
      void enqueueDraftSave(buildDraftSource(nextItems), true);
    },
    [buildDraftSource, commitFileOperation, commitItems, enqueueDraftSave],
  );

  const handleFileChange = (
    clientItemId: string,
    kind: "original" | "reference",
    file: File | null,
  ) => {
    if (file) void uploadDraftFile(clientItemId, kind, file);
    else cancelLocalCandidate(clientItemId, kind);
  };

  const handleRemovePersistedFile = async (
    clientItemId: string,
    kind: "original" | "reference",
  ) => {
    const removed = await removePersistedFile(clientItemId, kind);
    if (removed) void enqueueDraftSave(buildDraftSource(itemsRef.current), true);
  };

  const handleRetryFile = (
    clientItemId: string,
    kind: "original" | "reference",
  ) => {
    const operation = fileOperationsRef.current[fileSlotKey(clientItemId, kind)];
    if (operation?.retryFile) {
      void uploadDraftFile(clientItemId, kind, operation.retryFile);
    } else if (operation?.retryRemove) {
      void handleRemovePersistedFile(clientItemId, kind);
    }
  };

  const handleRemoveItem = async (clientItemId: string) => {
    const kinds = ["original", "reference"] as const;
    const operations = kinds.map(
      (kind) => fileOperationsRef.current[fileSlotKey(clientItemId, kind)],
    );
    if (operations.some((operation) => operation && operation.phase !== "error")) {
      setDraftError("Wait for the current image operation before removing this image.");
      return;
    }
    const currentDraftId = draftIdRef.current;
    for (const kind of kinds) {
      const slotKey = fileSlotKey(clientItemId, kind);
      const operation = fileOperationsRef.current[slotKey];
      if (operation?.pendingFileId && currentDraftId) {
        const removedPending = await deleteOrderDraftFile(
          currentDraftId,
          operation.pendingFileId,
        );
        if (!removedPending.ok) {
          setOperationError(
            slotKey,
            operation.generation,
            removedPending.message,
            operation.retryFile,
          );
          return;
        }
      }
      commitFileOperation(slotKey, null);
    }
    const originalRemoved = await removePersistedFile(clientItemId, "original");
    if (!originalRemoved) return;
    const referenceRemoved = await removePersistedFile(clientItemId, "reference");
    if (!referenceRemoved) return;
    const nextItems = itemsRef.current.filter(
      (item) => item.clientItemId !== clientItemId,
    );
    commitItems(nextItems);
    void enqueueDraftSave(buildDraftSource(nextItems), true);
  };

  const clearFinalizationRetryContext = useCallback((currentDraftId?: string) => {
    const target = currentDraftId ?? finalizationRetryContextRef.current?.draftId;
    if (target) removeStoredFinalizationRetryContext(target);
    finalizationRetryContextRef.current = null;
    setFinalizationRetryContext(null);
  }, []);

  const applyFinalizationResult = useCallback(
    (
      result: DraftFinalizationClientResult,
      context: DraftFinalizationRetryContext,
      startedSession: number,
    ) => {
      if (
        !shouldApplyVirtualRenovationAsyncResult(
          startedSession,
          draftSessionRef.current,
        )
      ) {
        return;
      }
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
      if (result.ok) {
        clearFinalizationRetryContext(context.draftId);
        setOrderId(result.data.orderId);
        setOrderNumber(result.data.orderNumber);
        setConfirmationEmailSent(result.data.confirmationEmailSent);
        setSubmitted(true);
        return;
      }
      if (result.code === "unauthenticated") {
        window.location.href = `/login?redirectTo=${encodeURIComponent(orderRoute)}`;
        return;
      }
      if (result.code === "profile_incomplete") {
        window.location.href = `/dashboard/profile?onboarding=1&next=${encodeURIComponent(orderRoute)}`;
        return;
      }
      if (
        !shouldPreserveDraftFinalizationKeyAfterFailure({
          code: result.code,
          status: result.status,
        })
      ) {
        clearFinalizationRetryContext(context.draftId);
      }
      setSubmitError(result.message);
    },
    [clearFinalizationRetryContext, orderRoute],
  );

  const submitWithContext = useCallback(
    async (context: DraftFinalizationRetryContext) => {
      if (submissionInFlightRef.current) return;
      submissionInFlightRef.current = true;
      setIsSubmitting(true);
      setSubmitError("");
      finalizationRetryContextRef.current = context;
      setFinalizationRetryContext(context);
      writeStoredFinalizationRetryContext(context);
      const startedSession = draftSessionRef.current;
      const result = await submitOrderDraft(
        context.draftId,
        context.expectedVersion,
        context.finalizationKey,
      );
      applyFinalizationResult(result, context, startedSession);
    },
    [applyFinalizationResult],
  );

  const handleSubmit = async () => {
    if (submissionInFlightRef.current) return;
    const retry = finalizationRetryContextRef.current;
    if (retry) {
      await submitWithContext(retry);
      return;
    }
    const saved = await enqueueDraftSave(buildDraftSource(), true);
    if (!saved) {
      setSubmitError("Save the draft successfully before submitting the order.");
      return;
    }
    const files = await listOrderDraftFiles(saved.draftId);
    if (!files.ok) {
      setSubmitError(files.message);
      return;
    }
    commitUploadedFiles(files.data);
    const allOriginalsPersisted = itemsRef.current.every((item) =>
      files.data.some(
        (file) =>
          file.kind === "original" && file.itemClientId === item.clientItemId,
      ),
    );
    if (!allOriginalsPersisted) {
      setSubmitError("Every image must finish uploading before submission.");
      return;
    }
    await submitWithContext({
      draftId: saved.draftId,
      expectedVersion: saved.version,
      finalizationKey: crypto.randomUUID(),
    });
  };

  const handleFinalizationRecovery = async () => {
    if (!finalizationRecovery || isSubmitting) return;
    if (finalizationRecovery.status === "finalization_in_progress") {
      const status = await getOrderDraftFinalizationStatus(
        finalizationRecovery.draftId,
      );
      if (!status.ok) setSubmitError(status.message);
      else applyFinalizationStatus(status.data);
      return;
    }
    await submitWithContext(
      readStoredFinalizationRetryContext(finalizationRecovery.draftId) ?? {
        draftId: finalizationRecovery.draftId,
        expectedVersion: finalizationRecovery.expectedVersion,
        finalizationKey: crypto.randomUUID(),
      },
    );
  };

  const startNewOrder = useCallback(() => {
    const previousDraftId = draftIdRef.current;
    draftSessionRef.current += 1;
    saveQueueRef.current = Promise.resolve();
    const reset = resetVirtualRenovationDraftIdentity(window.location.search);
    clearFinalizationRetryContext(previousDraftId ?? undefined);
    submissionInFlightRef.current = false;
    commitItems([emptyRenovationItem()]);
    commitUploadedFiles([]);
    fileOperationsRef.current = {};
    setFileOperations({});
    setJobTitle("");
    jobTitleRef.current = "";
    setOrderTerms(emptyOrderTerms);
    orderTermsRef.current = emptyOrderTerms;
    setIsSubmitting(false);
    setSubmitted(false);
    setOrderId("");
    setOrderNumber("");
    setConfirmationEmailSent(false);
    setSubmitError("");
    setDraftError("");
    setFinalizationRecovery(null);
    setDraftId(reset.draftId);
    draftIdRef.current = reset.draftId;
    setDraftVersion(reset.draftVersion);
    draftVersionRef.current = reset.draftVersion;
    savedFingerprintRef.current = null;
    failedFingerprintRef.current = null;
    setSaveStatus(reset.saveStatus);
    setResumeState("ready");
    replaceDraftUrl(reset.nextSearch);
  }, [
    clearFinalizationRetryContext,
    commitItems,
    commitUploadedFiles,
    replaceDraftUrl,
  ]);

  const hasActiveFileOperation = Object.values(fileOperations).some(
    (operation) => operation.phase !== "error",
  );
  const allItemsValid = items.every(
    (item) =>
      item.file === null &&
      item.referenceFile === null &&
      item.room !== "" &&
      (item.selectedInternal.length > 0 || item.selectedExternal.length > 0) &&
      uploadedFilesBySlot.has(fileSlotKey(item.clientItemId, "original")),
  );
  const canSubmit =
    items.length > 0 &&
    allItemsValid &&
    orderTerms.accepted &&
    isJobTitleValid(jobTitle) &&
    !hasActiveFileOperation &&
    saveStatus !== "conflict" &&
    resumeState === "ready";
  const editsDisabled = isSubmitting || finalizationRetryContext !== null;
  const startNewDisabled =
    editsDisabled || hasActiveFileOperation || saveStatus === "saving";
  const summaryItems: SummaryItem[] = items.map((item, index) => ({
    label: item.room || `Image #${index + 1}`,
  }));

  if (submitted) {
    return (
      <section className="min-h-screen bg-surface py-16">
        <Container>
          <Confirmation
            orderId={orderId}
            orderNumber={orderNumber}
            email={clientEmail}
            jobTitle={jobTitle}
            confirmationEmailSent={confirmationEmailSent}
            onNewOrder={startNewOrder}
          />
        </Container>
      </section>
    );
  }

  if (resumeState === "loading") {
    return (
      <section className="min-h-screen bg-surface py-16">
        <Container>
          <div className="rounded-xl border border-border bg-white p-8 text-center text-sm text-muted shadow-sm">
            Restoring your saved Virtual Renovation draft...
          </div>
        </Container>
      </section>
    );
  }

  if (resumeState === "finalization_recovery" && finalizationRecovery) {
    const canFinish = finalizationRecovery.status === "reconciliation_required";
    return (
      <section className="min-h-screen bg-surface py-16">
        <Container>
          <div className="rounded-xl border border-border bg-white p-8 shadow-sm">
            <h1 className="text-xl font-bold text-primary">
              {canFinish ? "Finish creating your order" : "Order creation is in progress"}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {canFinish
                ? "Your order exists and its durable draft needs one safe reconciliation step."
                : "Check again before starting another order."}
            </p>
            {canFinish ? (
              <p className="mt-3 text-sm font-medium text-foreground">
                Order: {finalizationRecovery.orderNumber}
              </p>
            ) : null}
            {submitError ? (
              <p role="alert" className="mt-4 text-sm text-red-700">
                {submitError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleFinalizationRecovery()}
                disabled={isSubmitting}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSubmitting ? "Checking..." : canFinish ? "Finish order" : "Check again"}
              </button>
              <button
                type="button"
                onClick={startNewOrder}
                disabled={isSubmitting}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
              >
                Start New
              </button>
            </div>
          </div>
        </Container>
      </section>
    );
  }

  if (resumeState === "error") {
    return (
      <section className="min-h-screen bg-surface py-16">
        <Container>
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-primary">
              Draft could not be restored
            </h1>
            <p className="mt-2 text-sm text-muted">
              {draftError || "The draft is unavailable or belongs to another order form."}
            </p>
            <button
              type="button"
              onClick={startNewOrder}
              className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Start New
            </button>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <OrderLayout
      title="Virtual Renovation"
      subtitle="Select renovation options for each image. Price is calculated based on your selections."
      sidebar={
        <OrderSummary
          serviceName="Virtual Renovation"
          items={summaryItems}
          pricingInput={{
            serviceType: "virtual-renovation",
            items: items.map((item) => ({
              selectedInternal: item.selectedInternal,
              selectedExternal: item.selectedExternal,
            })),
          }}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          canSubmit={canSubmit || finalizationRetryContext !== null}
          submitLabel={
            finalizationRetryContext ? "Retry submission" : undefined
          }
        />
      }
    >
      {submitError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {submitError}
        </div>
      ) : null}

      {draftError ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {draftError}
          {saveStatus === "conflict" ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ml-2 font-semibold underline"
            >
              Reload latest
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-5 flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted" aria-live="polite">
          {saveStatus === "saving"
            ? "Saving draft..."
            : saveStatus === "saved"
              ? "Draft saved"
              : saveStatus === "save_failed"
                ? "Draft not saved"
                : saveStatus === "conflict"
                  ? "Draft conflict"
                  : ""}
        </p>
        {draftId !== null ? (
          <button
            type="button"
            onClick={startNewOrder}
            disabled={startNewDisabled}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start New
          </button>
        ) : null}
      </div>

      <fieldset disabled={editsDisabled} className="contents">
        <OrderJobTitleField
          value={jobTitle}
          onChange={(value) => {
            jobTitleRef.current = value;
            setJobTitle(value);
          }}
        />

        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <p>
            Some renovation edits may require custom review if the image involves
            major reconstruction or unclear source material. We will confirm the
            final price before starting.
          </p>
        </div>

        <div className="space-y-5">
        {items.map((item, index) => {
          const originalKey = fileSlotKey(item.clientItemId, "original");
          const referenceKey = fileSlotKey(item.clientItemId, "reference");
          const originalOperation = fileOperations[originalKey];
          const referenceOperation = fileOperations[referenceKey];
          return (
            <RenovationItemCard
              key={item.clientItemId}
              index={index}
              data={item}
              onChange={(data) => handleItemChange(item.clientItemId, data)}
              onRemove={() => void handleRemoveItem(item.clientItemId)}
              canRemove={items.length > 1}
              persistedOriginal={uploadedFilesBySlot.get(originalKey)}
              persistedReference={uploadedFilesBySlot.get(referenceKey)}
              onOriginalFileChange={(file) =>
                handleFileChange(item.clientItemId, "original", file)
              }
              onReferenceFileChange={(file) =>
                handleFileChange(item.clientItemId, "reference", file)
              }
              onRemovePersistedOriginal={() =>
                void handleRemovePersistedFile(item.clientItemId, "original")
              }
              onRemovePersistedReference={() =>
                void handleRemovePersistedFile(item.clientItemId, "reference")
              }
              originalOperationStatus={
                originalOperation?.phase !== "error"
                  ? originalOperation?.message
                  : undefined
              }
              originalOperationError={originalOperation?.error || undefined}
              referenceOperationStatus={
                referenceOperation?.phase !== "error"
                  ? referenceOperation?.message
                  : undefined
              }
              referenceOperationError={referenceOperation?.error || undefined}
              onRetryOriginal={
                originalOperation?.error
                  ? () => handleRetryFile(item.clientItemId, "original")
                  : undefined
              }
              onRetryReference={
                referenceOperation?.error
                  ? () => handleRetryFile(item.clientItemId, "reference")
                  : undefined
              }
              fileOperationDisabled={
                editsDisabled ||
                (Boolean(originalOperation) && originalOperation?.phase !== "error") ||
                (Boolean(referenceOperation) && referenceOperation?.phase !== "error")
              }
            />
          );
        })}
        </div>

        <button
          type="button"
          onClick={handleAddItem}
          disabled={hasActiveFileOperation || editsDisabled}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Another Image
        </button>

        <OrderTermsBlock
          data={orderTerms}
          onChange={(next) => {
            orderTermsRef.current = next;
            setOrderTerms(next);
          }}
        />
      </fieldset>
    </OrderLayout>
  );
}

function readStoredFinalizationRetryContext(
  draftId: string,
): DraftFinalizationRetryContext | null {
  try {
    const key = buildOrderDraftFinalizationRetryStorageKey(draftId);
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = parseDraftFinalizationRetryContext(raw, draftId);
    if (!parsed) window.sessionStorage.removeItem(key);
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredFinalizationRetryContext(
  context: DraftFinalizationRetryContext,
): void {
  try {
    window.sessionStorage.setItem(
      buildOrderDraftFinalizationRetryStorageKey(context.draftId),
      serializeDraftFinalizationRetryContext(context),
    );
  } catch {
    // Server state remains authoritative when session storage is unavailable.
  }
}

function removeStoredFinalizationRetryContext(draftId: string): void {
  try {
    window.sessionStorage.removeItem(
      buildOrderDraftFinalizationRetryStorageKey(draftId),
    );
  } catch {
    // Server state remains authoritative when session storage is unavailable.
  }
}
