"use client";

import { usePartnerPricing } from "@/components/order/PartnerPricingContext";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import OrderLayout from "@/components/order/OrderLayout";
import OrderGuideRail, {
  type OrderGuideStep,
} from "@/components/order/OrderGuideRail";
import OrderReviewAction from "@/components/order/OrderReviewAction";
import OrderSummary, { type SummaryItem } from "@/components/order/OrderSummary";
import OrderStepIndicator from "@/components/order/OrderStepIndicator";
import { TWO_STEP_ORDER_STEPS } from "@/components/order/order-flow-copy";
import {
  type OrderTermsData,
  emptyOrderTerms,
} from "@/components/order/OrderTermsBlock";
import Confirmation from "@/components/order/Confirmation";
import OrderJobTitleField, {
  isJobTitleValid,
} from "@/components/order/OrderJobTitleField";
import { redirectOnOrderAuthError } from "@/components/order/order-redirect";
import { useDisplayRegion } from "@/components/pricing/currency-client";
import { submitOrder } from "@/lib/submit-order";
import Container from "@/components/layout/Container";
import {
  scrollDashboardToTop,
  scrollElementIntoViewWithinDashboard,
} from "@/lib/dashboard-scroll";
import { currencyForRegion } from "@/lib/currency";
import type { ServiceOptionMedia } from "@/lib/site-media";
import {
  SINGLE_EXPOSURE_OPTION_ID,
  SINGLE_EXPOSURE_SUB_SERVICE,
  getEffectiveDaySkyStyle,
  getSingleExposureSelectedOptions,
} from "@/lib/image-enhancement";
import {
  createOrderDraft,
  deleteOrderDraft,
  getOrderDraft,
  isOrderDraftVersionConflict,
  updateOrderDraft,
} from "@/lib/order-drafts/client";
import {
  completeOrderDraftFileUpload,
  deleteOrderDraftFile,
  getOrderDraftFilePreview,
  listOrderDraftFiles,
  prepareOrderDraftFileUpload,
  uploadPreparedOrderDraftFile,
} from "@/lib/order-drafts/files-client";
import type { OrderDraftUploadedFileSummary } from "@/lib/order-drafts/files";
import { UuidSchema } from "@/lib/order-drafts/schema";
import {
  buildSingleExposureCreateDraftInput,
  buildSingleExposureDraftFileSlotKey,
  buildSingleExposureDraftFingerprint,
  buildSingleExposureUpdateDraftInput,
  hasMeaningfulSingleExposureDraftChange,
  isSingleExposureItemConfigurationValid,
  resolveSingleExposureDraftRegion,
  validateSingleExposureDraftForResume,
  type SingleExposureAutosaveStatus,
  type SingleExposureFormDraftSource,
  type SingleExposureFormStep,
} from "@/lib/order-drafts/single-exposure";
import SingleExposureItemCard, {
  type SingleExposureItemData,
  emptySingleExposureItem,
  singleExposureItemDomId,
} from "./SingleExposureItemCard";
import SingleExposureReview from "./SingleExposureReview";
import { normalizeReferenceLink } from "@/lib/reference-files";
import {
  completeDraftReferenceFile,
  deleteDraftReferenceFile,
  listDraftReferenceFiles,
  prepareDraftReferenceFile,
  uploadPreparedDraftReferenceFile,
} from "@/lib/order-drafts/draft-reference-files-client";
import type { ReferenceFileValue } from "@/lib/reference-files";
import type { WelcomeOfferAvailability } from "@/lib/welcome-offer";
import { calculateOrderQuote } from "@/lib/pricing/calculate";
import {
  applyAuthoritativeWelcomeOfferSnapshot,
  createPricingExpectation,
} from "@/lib/pricing/expectation";

const SERVICE_NAME = "Image Enhancement — Single Exposure";
const STEPS = TWO_STEP_ORDER_STEPS;

const SINGLE_EXPOSURE_GUIDE_STEPS: OrderGuideStep[] = [
  {
    title: "Upload",
    description: "Add the original photo for each image you want enhanced.",
  },
  {
    title: "Choose",
    description:
      "Set image preferences, optional add-ons and any aerial editing direction.",
  },
  {
    title: "Review",
    description:
      "Review every photo, selection and estimated total before submitting.",
  },
];

interface SingleExposureOrderFormProps {
  clientEmail: string;
  orderRoute: string;
  exampleMediaByKey: Record<string, ServiceOptionMedia>;
  welcomeOfferAvailability: WelcomeOfferAvailability;
}

interface DraftSaveOutcome {
  draftId: string;
  version: number;
}

type DraftFileKind = "original" | "reference";

export default function SingleExposureOrderForm({
  clientEmail,
  orderRoute,
  exampleMediaByKey,
  welcomeOfferAvailability,
}: SingleExposureOrderFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedDraftId = searchParams.get("draft");
  const requestedDraftIsValid =
    !requestedDraftId || UuidSchema.safeParse(requestedDraftId).success;
  const [region, setRegion] = useDisplayRegion();
  const currency = currencyForRegion(region);
  const { partnerClient, applyPartnerSnapshot } = usePartnerPricing();
  const [items, setItems] = useState<SingleExposureItemData[]>([
    emptySingleExposureItem(),
  ]);
  const [jobTitle, setJobTitle] = useState("");
  const [orderTerms, setOrderTerms] = useState<OrderTermsData>(emptyOrderTerms);
  const [step, setStep] = useState<SingleExposureFormStep>("configure");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [activeWelcomeOfferAvailability, setActiveWelcomeOfferAvailability] =
    useState(welcomeOfferAvailability);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(() =>
    requestedDraftId && UuidSchema.safeParse(requestedDraftId).success
      ? requestedDraftId
      : null,
  );
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] =
    useState<SingleExposureAutosaveStatus>("not_saved");
  const [draftError, setDraftError] = useState(() =>
    requestedDraftIsValid ? "" : "Draft link is invalid.",
  );
  const [resumeState, setResumeState] = useState<"loading" | "ready" | "error">(
    requestedDraftId
      ? requestedDraftIsValid
        ? "loading"
        : "error"
      : "ready",
  );
  const [uploadedDraftFiles, setUploadedDraftFiles] = useState<
    OrderDraftUploadedFileSummary[]
  >([]);
  const [fileOperationStatus, setFileOperationStatus] = useState<
    Record<string, string>
  >({});

  const itemsRef = useRef(items);
  const jobTitleRef = useRef(jobTitle);
  const orderTermsRef = useRef(orderTerms);
  const stepRef = useRef(step);
  const draftIdRef = useRef(draftId);
  const draftVersionRef = useRef(draftVersion);
  const uploadedDraftFilesRef = useRef(uploadedDraftFiles);
  const submittingRef = useRef(false);
  const savedFingerprintRef = useRef<string | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingScrollRef = useRef<string | "top" | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    jobTitleRef.current = jobTitle;
  }, [jobTitle]);
  useEffect(() => {
    orderTermsRef.current = orderTerms;
  }, [orderTerms]);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);
  useEffect(() => {
    draftVersionRef.current = draftVersion;
  }, [draftVersion]);
  useEffect(() => {
    uploadedDraftFilesRef.current = uploadedDraftFiles;
  }, [uploadedDraftFiles]);

  useEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending) return;
    pendingScrollRef.current = null;
    const frame = requestAnimationFrame(() => {
      if (pending === "top") scrollDashboardToTop();
      else scrollElementIntoViewWithinDashboard(pending);
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);

  const uploadedFilesBySlot = useMemo(() => {
    const map = new Map<string, OrderDraftUploadedFileSummary>();
    for (const file of uploadedDraftFiles) {
      map.set(
        buildSingleExposureDraftFileSlotKey(file.itemClientId, file.kind),
        file,
      );
    }
    return map;
  }, [uploadedDraftFiles]);

  const buildDraftSource = useCallback(
    (
      nextItems = itemsRef.current,
      nextStep = stepRef.current,
      nextTerms = orderTermsRef.current,
    ): SingleExposureFormDraftSource => ({
      jobTitle: jobTitleRef.current,
      step: nextStep,
      items: nextItems,
      orderTerms: nextTerms,
      currency,
      region,
    }),
    [currency, region],
  );

  const replaceDraftQuery = useCallback(
    (nextDraftId: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (nextDraftId) next.set("draft", nextDraftId);
      else next.delete("draft");
      router.replace(next.size ? `${pathname}?${next}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const persistDraft = useCallback(
    async (
      source: SingleExposureFormDraftSource,
      force = false,
    ): Promise<DraftSaveOutcome | null> => {
      if (!hasMeaningfulSingleExposureDraftChange(source)) return null;
      const fingerprint = buildSingleExposureDraftFingerprint(source);
      if (!force && fingerprint === savedFingerprintRef.current) {
        const currentId = draftIdRef.current;
        const currentVersion = draftVersionRef.current;
        return currentId && currentVersion
          ? { draftId: currentId, version: currentVersion }
          : null;
      }

      setSaveStatus("saving");
      setDraftError("");
      const currentId = draftIdRef.current;
      if (!currentId) {
        const result = await createOrderDraft(
          buildSingleExposureCreateDraftInput(source),
        );
        if (!result.ok) {
          setSaveStatus("save_failed");
          setDraftError(result.message);
          return null;
        }
        draftIdRef.current = result.data.id;
        draftVersionRef.current = result.data.version;
        setDraftId(result.data.id);
        setDraftVersion(result.data.version);
        savedFingerprintRef.current = fingerprint;
        setSaveStatus("saved");
        replaceDraftQuery(result.data.id);
        return { draftId: result.data.id, version: result.data.version };
      }

      const currentVersion = draftVersionRef.current;
      if (!currentVersion) {
        setSaveStatus("save_failed");
        setDraftError("Draft version is not ready yet.");
        return null;
      }
      const result = await updateOrderDraft(
        currentId,
        buildSingleExposureUpdateDraftInput(source, currentVersion),
      );
      if (!result.ok) {
        if (isOrderDraftVersionConflict(result)) {
          setSaveStatus("conflict");
          setDraftError(
            "This draft changed in another tab. Reload the latest draft before continuing.",
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
      setSaveStatus("saved");
      return { draftId: currentId, version: result.data.version };
    },
    [replaceDraftQuery],
  );

  const enqueueDraftSave = useCallback(
    (
      source = buildDraftSource(),
      force = false,
    ): Promise<DraftSaveOutcome | null> => {
      const operation = saveQueueRef.current.then(() =>
        persistDraft(source, force),
      );
      saveQueueRef.current = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
    [buildDraftSource, persistDraft],
  );

  const refreshDraftFiles = useCallback(async (currentDraftId: string) => {
    const result = await listOrderDraftFiles(currentDraftId);
    if (!result.ok) {
      setDraftError(result.message);
      return false;
    }
    uploadedDraftFilesRef.current = result.data;
    setUploadedDraftFiles(result.data);
    return true;
  }, []);

  useEffect(() => {
    if (!requestedDraftId) return;
    if (
      requestedDraftId === draftIdRef.current &&
      resumeState === "ready"
    ) {
      return;
    }
    if (!requestedDraftIsValid) return;
    const controller = new AbortController();
    void getOrderDraft(requestedDraftId, controller.signal).then(
      async (result) => {
        if (!result.ok) {
          setDraftError(result.message);
          setResumeState("error");
          return;
        }
        const restored = validateSingleExposureDraftForResume(result.data);
        if (!restored.ok) {
          setDraftError(restored.message);
          setResumeState("error");
          return;
        }
        const restoredRegion = resolveSingleExposureDraftRegion(result.data);
        setRegion(restoredRegion);
        let restoredItems = restored.form.items as SingleExposureItemData[];
        const restoredReferences = await listDraftReferenceFiles(result.data.id);
        if (restoredReferences.ok) {
          restoredItems = restoredItems.map((item) => ({
            ...item,
            referenceFiles: restoredReferences.data.filter(
              (reference) => reference.itemClientId === item.clientItemId,
            ),
          }));
        }
        setItems(restoredItems);
        itemsRef.current = restoredItems;
        setJobTitle(restored.form.jobTitle);
        jobTitleRef.current = restored.form.jobTitle;
        setOrderTerms(restored.form.orderTerms);
        orderTermsRef.current = restored.form.orderTerms;
        setStep(restored.form.step);
        stepRef.current = restored.form.step;
        setDraftId(result.data.id);
        draftIdRef.current = result.data.id;
        setDraftVersion(restored.version);
        draftVersionRef.current = restored.version;
        savedFingerprintRef.current = buildSingleExposureDraftFingerprint({
          jobTitle: restored.form.jobTitle,
          step: restored.form.step,
          items: restoredItems,
          orderTerms: restored.form.orderTerms,
          currency: result.data.currency,
          region: restoredRegion,
        });
        await refreshDraftFiles(result.data.id);
        setSaveStatus("saved");
        setResumeState("ready");
      },
    );
    return () => controller.abort();
  }, [
    refreshDraftFiles,
    requestedDraftId,
    requestedDraftIsValid,
    resumeState,
    setRegion,
  ]);

  useEffect(() => {
    if (resumeState !== "ready" || saveStatus === "conflict" || submitted) {
      return;
    }
    const source = buildDraftSource(items, step, orderTerms);
    if (!hasMeaningfulSingleExposureDraftChange(source)) return;
    const timer = window.setTimeout(() => {
      void enqueueDraftSave(source);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    buildDraftSource,
    enqueueDraftSave,
    items,
    jobTitle,
    orderTerms,
    resumeState,
    saveStatus,
    step,
    submitted,
  ]);

  const commitItems = (next: SingleExposureItemData[]) => {
    itemsRef.current = next;
    setItems(next);
  };

  const handleItemChange = (index: number, data: SingleExposureItemData) => {
    commitItems(itemsRef.current.map((item, i) => (i === index ? data : item)));
  };

  const handleAddItem = () => {
    commitItems([...itemsRef.current, emptySingleExposureItem()]);
  };

  const removePersistedFile = useCallback(
    async (item: SingleExposureItemData, kind: DraftFileKind) => {
      const currentDraftId = draftIdRef.current;
      const slotKey = buildSingleExposureDraftFileSlotKey(
        item.clientItemId,
        kind,
      );
      const uploaded = uploadedDraftFilesRef.current.find(
        (file) =>
          buildSingleExposureDraftFileSlotKey(file.itemClientId, file.kind) ===
          slotKey,
      );
      if (!currentDraftId || !uploaded) return true;
      setFileOperationStatus((current) => ({
        ...current,
        [slotKey]: "Removing saved file...",
      }));
      const result = await deleteOrderDraftFile(currentDraftId, uploaded.id);
      setFileOperationStatus((current) => {
        const next = { ...current };
        delete next[slotKey];
        return next;
      });
      if (!result.ok) {
        setDraftError(result.message);
        return false;
      }
      const nextFiles = uploadedDraftFilesRef.current.filter(
        (file) => file.id !== uploaded.id,
      );
      uploadedDraftFilesRef.current = nextFiles;
      setUploadedDraftFiles(nextFiles);
      return true;
    },
    [],
  );

  const handleRemoveItem = async (index: number) => {
    const item = itemsRef.current[index];
    if (!item) return;
    const originalRemoved = await removePersistedFile(item, "original");
    const referenceRemoved = await removePersistedFile(item, "reference");
    if (!originalRemoved || !referenceRemoved) return;
    commitItems(itemsRef.current.filter((_, i) => i !== index));
  };

  const handleDraftFileChange = useCallback(
    async (index: number, kind: DraftFileKind, file: File | null) => {
      const item = itemsRef.current[index];
      if (!item) return;
      const slotKey = buildSingleExposureDraftFileSlotKey(
        item.clientItemId,
        kind,
      );

      if (!file) {
        const removed = await removePersistedFile(item, kind);
        if (!removed) return;
        const nextItems = itemsRef.current.map((candidate, candidateIndex) =>
          candidateIndex === index
            ? {
                ...candidate,
                ...(kind === "original"
                  ? { file: null, originalFilename: null }
                  : { referenceFile: null, referenceFilename: null }),
              }
            : candidate,
        );
        commitItems(nextItems);
        void enqueueDraftSave(buildDraftSource(nextItems), true);
        return;
      }

      const nextItems = itemsRef.current.map((candidate, candidateIndex) =>
        candidateIndex === index
          ? {
              ...candidate,
              ...(kind === "original"
                ? { file, originalFilename: file.name }
                : { referenceFile: file, referenceFilename: file.name }),
            }
          : candidate,
      );
      commitItems(nextItems);
      setFileOperationStatus((current) => ({
        ...current,
        [slotKey]: "Saving draft file...",
      }));
      const saved = await enqueueDraftSave(buildDraftSource(nextItems), true);
      if (!saved) {
        setFileOperationStatus((current) => {
          const next = { ...current };
          delete next[slotKey];
          return next;
        });
        return;
      }

      const prepared = await prepareOrderDraftFileUpload(saved.draftId, {
        itemClientId: item.clientItemId,
        kind,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
      if (!prepared.ok) {
        setDraftError(prepared.message);
        setFileOperationStatus((current) => {
          const next = { ...current };
          delete next[slotKey];
          return next;
        });
        return;
      }
      const uploaded = await uploadPreparedOrderDraftFile(prepared.data, file);
      if (!uploaded.ok) {
        setDraftError(uploaded.message);
        setFileOperationStatus((current) => {
          const next = { ...current };
          delete next[slotKey];
          return next;
        });
        return;
      }
      const completed = await completeOrderDraftFileUpload(
        saved.draftId,
        prepared.data.file.id,
      );
      if (!completed.ok) {
        setDraftError(completed.message);
      } else {
        const nextFiles = [
          ...uploadedDraftFilesRef.current.filter(
            (candidate) =>
              buildSingleExposureDraftFileSlotKey(
                candidate.itemClientId,
                candidate.kind,
              ) !== slotKey,
          ),
          completed.data,
        ];
        uploadedDraftFilesRef.current = nextFiles;
        setUploadedDraftFiles(nextFiles);
      }
      setFileOperationStatus((current) => {
        const next = { ...current };
        delete next[slotKey];
        return next;
      });
    },
    [buildDraftSource, enqueueDraftSave, removePersistedFile],
  );

  const handleReferenceFilesChange = useCallback(
    async (index: number, nextReferences: ReferenceFileValue[]) => {
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

      const saved = await enqueueDraftSave(buildDraftSource(nextItems), true);
      if (!saved) return;
      const operationKey = `${item.clientItemId}:references`;
      setFileOperationStatus((current) => ({
        ...current,
        [operationKey]: "Saving reference files...",
      }));
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
      void enqueueDraftSave(buildDraftSource(committed), true);
      setFileOperationStatus((current) => {
        const next = { ...current };
        delete next[operationKey];
        return next;
      });
    },
    [buildDraftSource, enqueueDraftSave],
  );

  const handleApplyToAll = (sourceIndex: number) => {
    const source = itemsRef.current[sourceIndex];
    if (!source) return;
    commitItems(
      itemsRef.current.map((item, index) =>
        index === sourceIndex
          ? item
          : {
              ...item,
              grassRepair: source.grassRepair,
              skyReplacement: source.skyReplacement,
              tvScreenReplacement: source.tvScreenReplacement,
              addFireToFireplace: source.addFireToFireplace,
              daySkyStyle: source.daySkyStyle,
              fileSizeLimit: source.fileSizeLimit,
            },
      ),
    );
  };

  const configureValid =
    items.length > 0 &&
    isJobTitleValid(jobTitle) &&
    items.every((item) => {
      const original = uploadedFilesBySlot.get(
        buildSingleExposureDraftFileSlotKey(item.clientItemId, "original"),
      );
      const reference = uploadedFilesBySlot.get(
        buildSingleExposureDraftFileSlotKey(item.clientItemId, "reference"),
      );
      return isSingleExposureItemConfigurationValid({
        hasOriginal: Boolean(item.file || original),
        hasReference: Boolean(
          item.referenceFiles.length > 0 || item.referenceFile || reference,
        ),
        skyReplacement: item.skyReplacement,
        daySkyStyle: item.daySkyStyle,
        aerialEditing: item.aerialEditing,
        aerialEditingInstructions: item.aerialEditingInstructions,
      }) && normalizeReferenceLink(item.referenceLink) !== null;
    });
  const fileOperationActive = Object.keys(fileOperationStatus).length > 0;
  const reviewValid =
    configureValid &&
    orderTerms.accepted &&
    orderTerms.earlyPerformanceRequested &&
    !fileOperationActive;

  const goToReview = () => {
    setValidationAttempted(true);
    setSubmitError("");
    if (!configureValid || fileOperationActive) return;
    pendingScrollRef.current = "top";
    stepRef.current = "review";
    setStep("review");
    void enqueueDraftSave(buildDraftSource(itemsRef.current, "review"), true);
  };

  const goToConfigure = () => {
    pendingScrollRef.current = "top";
    stepRef.current = "configure";
    setStep("configure");
  };

  const handleEditItem = (index: number) => {
    const item = itemsRef.current[index];
    if (!item) return;
    pendingScrollRef.current = singleExposureItemDomId(item.clientItemId);
    stepRef.current = "configure";
    setStep("configure");
  };

  const resolvePersistedFile = async (
    currentDraftId: string,
    persisted: OrderDraftUploadedFileSummary,
  ): Promise<File> => {
    const fetchFile = async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Saved draft file could not be loaded.");
      const blob = await response.blob();
      return new File([blob], persisted.originalFilename, {
        type: persisted.mimeType || blob.type,
        lastModified: Date.now(),
      });
    };
    if (persisted.previewUrl) {
      try {
        return await fetchFile(persisted.previewUrl);
      } catch {
        // Refresh an expired signed URL below.
      }
    }
    const preview = await getOrderDraftFilePreview(
      currentDraftId,
      persisted.id,
    );
    if (!preview.ok) throw new Error(preview.message);
    return fetchFile(preview.data.previewUrl);
  };

  const handleSubmit = async () => {
    if (submittingRef.current || !reviewValid || step !== "review") return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const saved = await enqueueDraftSave(
        buildDraftSource(itemsRef.current, "review", orderTermsRef.current),
        true,
      );
      const currentDraftId = saved?.draftId ?? draftIdRef.current;
      const listedReferences = currentDraftId
        ? await listDraftReferenceFiles(currentDraftId)
        : null;
      if (listedReferences && !listedReferences.ok) {
        throw new Error(listedReferences.message);
      }
      const resolvedFiles = await Promise.all(
        itemsRef.current.map(async (item) => {
          const persistedOriginal = uploadedFilesBySlot.get(
            buildSingleExposureDraftFileSlotKey(
              item.clientItemId,
              "original",
            ),
          );
          const persistedReference = uploadedFilesBySlot.get(
            buildSingleExposureDraftFileSlotKey(
              item.clientItemId,
              "reference",
            ),
          );
          const original =
            item.file ??
            (currentDraftId && persistedOriginal
              ? await resolvePersistedFile(currentDraftId, persistedOriginal)
              : null);
          if (!original) throw new Error("Every photo needs an original file.");
          const currentReferences = listedReferences?.ok
            ? listedReferences.data.filter(
                (reference) => reference.itemClientId === item.clientItemId,
              )
            : item.referenceFiles;
          const localReferences = await Promise.all(
            currentReferences.map(async (reference) => {
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
            }),
          );
          const legacyReference = item.referenceFile ??
            (currentDraftId && persistedReference
              ? await resolvePersistedFile(currentDraftId, persistedReference)
              : null);
          return {
            file: original,
            referenceFiles:
              localReferences.length > 0
                ? localReferences
                : legacyReference
                  ? [legacyReference]
                  : [],
          };
        }),
      );

      const itemsMetadata = itemsRef.current.map((item) => ({
        subService: SINGLE_EXPOSURE_SUB_SERVICE,
        selectedOptions: getSingleExposureSelectedOptions(
          item.selectedAddons,
          item.aerialEditing,
        ),
        fileSizeLimit: item.fileSizeLimit,
        disclaimerText: item.disclaimerText,
        additionalInfo: item.additionalInfo,
        referenceLink: item.referenceLink,
        grassRepair: item.grassRepair,
        skyReplacement: item.skyReplacement,
        tvScreenReplacement: item.tvScreenReplacement,
        addFireToFireplace: item.addFireToFireplace,
        daySkyStyle:
          getEffectiveDaySkyStyle(item.skyReplacement, item.daySkyStyle) ??
          undefined,
        aerialEditing: item.aerialEditing,
        aerialEditingInstructions: item.aerialEditingInstructions,
      }));

      const result = await submitOrder(
        "photo-editing",
        itemsMetadata,
        resolvedFiles,
        orderTermsRef.current,
        jobTitleRef.current,
        undefined,
        createPricingExpectation(
          calculateOrderQuote(
            {
              serviceType: "photo-editing",
              currency,
              items: itemsRef.current.map((item) => ({
                selectedOptions: getSingleExposureSelectedOptions(
                  item.selectedAddons,
                  item.aerialEditing,
                ),
                baseOptionId: SINGLE_EXPOSURE_OPTION_ID,
                dedicatedSubService: SINGLE_EXPOSURE_SUB_SERVICE,
              })),
            },
            { welcomeOfferAvailability: activeWelcomeOfferAvailability, partnerClient },
          ),
        ),
      );
      if (result.success && result.orderId && result.orderNumber) {
        setOrderId(result.orderId);
        setOrderNumber(result.orderNumber);
        setConfirmationEmailSent(result.confirmationEmailSent === true);
        setSubmitted(true);
        setActiveWelcomeOfferAvailability((current) => ({
          ...current,
          imageEnhancementAvailable: false,
        }));
        const currentId = draftIdRef.current;
        const currentVersion = draftVersionRef.current;
        if (currentId && currentVersion) {
          void deleteOrderDraft(currentId, currentVersion);
        }
        return;
      }
      if (redirectOnOrderAuthError(result, orderRoute)) return;
      if (result.errorCode === "pricing-changed") {
        applyPartnerSnapshot(result.currentPricingSnapshot);
        setActiveWelcomeOfferAvailability((current) =>
          applyAuthoritativeWelcomeOfferSnapshot(
            current,
            "image-enhancement-free",
            result.currentPricingSnapshot,
          ),
        );
      }
      setSubmitError(result.error || "Submission failed. Please try again.");
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Submission failed. Please try again.",
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleNewOrder = () => {
    const fresh = [emptySingleExposureItem()];
    commitItems(fresh);
    setJobTitle("");
    jobTitleRef.current = "";
    setOrderTerms(emptyOrderTerms);
    orderTermsRef.current = emptyOrderTerms;
    setStep("configure");
    stepRef.current = "configure";
    setSubmitted(false);
    setOrderId("");
    setOrderNumber("");
    setSubmitError("");
    setValidationAttempted(false);
    setDraftId(null);
    draftIdRef.current = null;
    setDraftVersion(null);
    draftVersionRef.current = null;
    setUploadedDraftFiles([]);
    uploadedDraftFilesRef.current = [];
    savedFingerprintRef.current = null;
    setSaveStatus("not_saved");
    replaceDraftQuery(null);
  };

  const summaryItems: SummaryItem[] = items.map((_, index) => ({
    label: `Photo #${index + 1}`,
  }));
  const pricingInput = {
    serviceType: "photo-editing" as const,
    items: items.map((item) => ({
      selectedOptions: getSingleExposureSelectedOptions(
        item.selectedAddons,
        item.aerialEditing,
      ),
      baseOptionId: SINGLE_EXPOSURE_OPTION_ID,
      dedicatedSubService: "image-enhancement-single-exposure",
    })),
  };

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
            onNewOrder={handleNewOrder}
          />
        </Container>
      </section>
    );
  }

  if (resumeState === "loading") {
    return (
      <section className="bg-surface py-16">
        <Container>
          <div className="rounded-xl border border-border bg-white p-8 text-center text-sm text-muted shadow-sm">
            Restoring your saved order draft...
          </div>
        </Container>
      </section>
    );
  }

  if (resumeState === "error") {
    return (
      <section className="bg-surface py-16">
        <Container>
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-primary">
              Draft could not be restored
            </h1>
            <p className="mt-2 text-sm text-muted">{draftError}</p>
          </div>
        </Container>
      </section>
    );
  }

  const isReview = step === "review";
  const sidebar = isReview ? (
    <OrderSummary
      serviceName={SERVICE_NAME}
      items={summaryItems}
      pricingInput={pricingInput}
      welcomeOfferAvailability={activeWelcomeOfferAvailability}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      canSubmit={reviewValid}
      submitLabel="Submit Order"
      submittingLabel="Submitting..."
    />
  ) : undefined;

  const guideInformation = (
    <>
      <p>
        Reference links and files are optional for standard enhancements. Add
        them when they clarify the result you want.
      </p>
      <p>
        When an aerial edit asks for details, provide meaningful instructions
        or at least one reference file.
      </p>
    </>
  );

  const guide = !isReview ? (
    <OrderGuideRail
      steps={SINGLE_EXPOSURE_GUIDE_STEPS}
      information={guideInformation}
    />
  ) : undefined;

  return (
    <OrderLayout
      title={SERVICE_NAME}
      subtitle="Professional colour, exposure, white balance, contrast and detail correction for standard real-estate photographs."
      header={<OrderStepIndicator steps={STEPS} currentStepId={step} />}
      sidebar={sidebar}
      leadingRail={guide}
      editorial={!isReview}
      workspaceVariant={isReview ? undefined : "wide"}
    >
      {draftError && resumeState === "ready" ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {draftError}
        </div>
      ) : null}

      <p className="text-dashboard-metadata text-muted" aria-live="polite">
        {saveStatus === "saving"
          ? "Saving draft..."
          : saveStatus === "saved"
            ? "Draft saved"
            : saveStatus === "save_failed"
              ? "Draft not saved"
              : ""}
      </p>

      {isReview ? (
        <SingleExposureReview
          jobTitle={jobTitle}
          items={items}
          uploadedFilesBySlot={uploadedFilesBySlot}
          orderTerms={orderTerms}
          onTermsChange={(next) => {
            orderTermsRef.current = next;
            setOrderTerms(next);
          }}
          onEditItem={handleEditItem}
          onBack={goToConfigure}
          submitError={submitError}
          disabled={isSubmitting}
          welcomeOfferAvailability={activeWelcomeOfferAvailability}
        />
      ) : (
        <>
          {submitError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {submitError}
            </div>
          ) : null}

          <OrderJobTitleField
            value={jobTitle}
            onChange={(value) => {
              jobTitleRef.current = value;
              setJobTitle(value);
            }}
          />

          <div className="space-y-5">
            {items.map((item, index) => {
              const originalSlot = buildSingleExposureDraftFileSlotKey(
                item.clientItemId,
                "original",
              );
              const referenceSlot = buildSingleExposureDraftFileSlotKey(
                item.clientItemId,
                "reference",
              );
              return (
                <SingleExposureItemCard
                  key={item.clientItemId}
                  index={index}
                  data={item}
                  onChange={(data) => handleItemChange(index, data)}
                  onReferenceFilesChange={(referenceFiles) =>
                    void handleReferenceFilesChange(index, referenceFiles)
                  }
                  onRemove={() => void handleRemoveItem(index)}
                  canRemove={items.length > 1}
                  exampleMediaByKey={exampleMediaByKey}
                  onApplyToAll={() => handleApplyToAll(index)}
                  showApplyToAll={items.length > 1}
                  persistedOriginal={uploadedFilesBySlot.get(originalSlot)}
                  persistedReference={uploadedFilesBySlot.get(referenceSlot)}
                  onOriginalFileChange={(file) =>
                    void handleDraftFileChange(index, "original", file)
                  }
                  onReferenceFileChange={(file) =>
                    void handleDraftFileChange(index, "reference", file)
                  }
                  onRemovePersistedOriginal={() =>
                    void handleDraftFileChange(index, "original", null)
                  }
                  onRemovePersistedReference={() =>
                    void handleDraftFileChange(index, "reference", null)
                  }
                  originalOperationStatus={fileOperationStatus[originalSlot]}
                  referenceOperationStatus={fileOperationStatus[referenceSlot]}
                  fileOperationsDisabled={fileOperationActive}
                  showErrors={validationAttempted}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-3 text-sm font-medium text-muted transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Another Photo
          </button>

          <OrderReviewAction
            onClick={goToReview}
            disabled={!configureValid || fileOperationActive}
          >
            <p>
              Next, review every photo, selected enhancement and the full
              estimated order total before submitting.
            </p>
          </OrderReviewAction>
        </>
      )}
    </OrderLayout>
  );
}
