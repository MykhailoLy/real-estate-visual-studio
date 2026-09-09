"use client";

import { usePartnerPricing } from "@/components/order/PartnerPricingContext";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import OrderLayout from "@/components/order/OrderLayout";
import OrderSummary, { type SummaryItem } from "@/components/order/OrderSummary";
import OrderGuideRail, {
  type OrderGuideStep,
} from "@/components/order/OrderGuideRail";
import OrderReviewAction from "@/components/order/OrderReviewAction";
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
import { submitOrder } from "@/lib/submit-order";
import Container from "@/components/layout/Container";
import {
  scrollDashboardToTop,
  scrollElementIntoViewWithinDashboard,
} from "@/lib/dashboard-scroll";
import type { ServiceOptionImage } from "@/lib/site-media";
import {
  DAY_TO_DUSK_SUB_SERVICE,
  DAY_TO_DUSK_OPTION_ID,
} from "@/lib/day-to-dusk";
import DayToDuskItemCard, {
  type DayToDuskItemData,
  emptyDayToDuskItem,
  dayToDuskItemDomId,
} from "./DayToDuskItemCard";
import DayToDuskReview from "./DayToDuskReview";
import ApplyToAllPreferencesToggle from "./ApplyToAllPreferencesToggle";
import { normalizeReferenceLink } from "@/lib/reference-files";
import type { ReferenceFileValue } from "@/lib/reference-files";
import { useDisplayRegion } from "@/components/pricing/currency-client";
import { currencyForRegion } from "@/lib/currency";
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
  buildDayToDuskCreateDraftInput,
  buildDayToDuskDraftFileSlotKey,
  buildDayToDuskDraftFingerprint,
  buildDayToDuskUpdateDraftInput,
  hasMeaningfulDayToDuskDraftChange,
  resolveDayToDuskDraftRegion,
  validateDayToDuskDraftForResume,
  type DayToDuskAutosaveStatus,
  type DayToDuskFormDraftSource,
} from "@/lib/order-drafts/day-to-dusk";
import {
  completeDraftReferenceFile,
  deleteDraftReferenceFile,
  listDraftReferenceFiles,
  prepareDraftReferenceFile,
  uploadPreparedDraftReferenceFile,
} from "@/lib/order-drafts/draft-reference-files-client";
import { calculateOrderQuote } from "@/lib/pricing/calculate";
import {
  applyAuthoritativeWelcomeOfferSnapshot,
  createPricingExpectation,
} from "@/lib/pricing/expectation";

// ============================================================
// DayToDuskOrderForm — dedicated Day to Dusk order flow.
//
// Two client-side steps on the SAME protected route:
//   "configure"  → upload + per-photo preferences (no upload/submit here)
//   "review"     → read-only review + terms + the only Submit Order action
//
// Backend model is UNCHANGED: serviceType "photo-editing", fixed option
// day-to-dusk-pe (canonical fixed-currency price), PE order numbering, sub_service =
// day-to-dusk. Identity is sourced server-side (no "Your Details" block).
//
// FUTURE PAYMENT EXTENSION POINT: the flow is intentionally modelled as
// an ordered list of steps. A later PR can grow STEPS to
//   [configure, review, payment]
// and add a "payment" branch below WITHOUT restructuring this component.
// No payment UI / API / data is introduced in this PR.
// ============================================================

type DayToDuskFormStep = "configure" | "review";

const STEPS = TWO_STEP_ORDER_STEPS;

const SERVICE_NAME = "Day to Dusk";

const DAY_TO_DUSK_GUIDE_STEPS: OrderGuideStep[] = [
  {
    title: "Upload",
    description:
      "Upload your daytime exterior photo and any optional references.",
  },
  {
    title: "Choose",
    description:
      "Select your preferred dusk sky style and lighting options.",
  },
  {
    title: "Review",
    description:
      "Review your photos, selected options and order total before submitting.",
  },
];

interface DayToDuskOrderFormProps {
  clientEmail: string;
  orderRoute: string;
  /** mediaKey → resolved dusk-style example image (admin-managed). */
  duskStyleImages: Record<string, ServiceOptionImage>;
  welcomeOfferAvailability: import("@/lib/welcome-offer").WelcomeOfferAvailability;
}

interface DraftSaveOutcome {
  draftId: string;
  version: number;
}

/** The preferences shared by the global "use Photo #1 preferences" toggle. */
type SharedPrefs = Pick<
  DayToDuskItemData,
  | "duskStyle"
  | "turnOnInteriorLights"
  | "turnOnExteriorLights"
  | "addPoolLights"
  | "fileSizeLimit"
>;

function pickShared(item: DayToDuskItemData): SharedPrefs {
  return {
    duskStyle: item.duskStyle,
    turnOnInteriorLights: item.turnOnInteriorLights,
    turnOnExteriorLights: item.turnOnExteriorLights,
    addPoolLights: item.addPoolLights,
    fileSizeLimit: item.fileSizeLimit,
  };
}

/** Copy the source item's shared preferences onto every other item. */
function applySharedFrom(
  items: DayToDuskItemData[],
  sourceIndex: number
): DayToDuskItemData[] {
  const source = items[sourceIndex];
  if (!source) return items;
  const shared = pickShared(source);
  return items.map((item, i) =>
    i === sourceIndex ? item : { ...item, ...shared }
  );
}

export default function DayToDuskOrderForm({
  clientEmail,
  orderRoute,
  duskStyleImages,
  welcomeOfferAvailability,
}: DayToDuskOrderFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedDraftId = searchParams.get("draft");
  const requestedDraftIsValid =
    !requestedDraftId || UuidSchema.safeParse(requestedDraftId).success;
  const [region, setRegion] = useDisplayRegion();
  const currency = currencyForRegion(region);
  const { partnerClient, applyPartnerSnapshot } = usePartnerPricing();
  const [step, setStep] = useState<DayToDuskFormStep>("configure");
  const [items, setItems] = useState<DayToDuskItemData[]>([
    emptyDayToDuskItem(),
  ]);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [orderTerms, setOrderTerms] = useState<OrderTermsData>(emptyOrderTerms);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [activeWelcomeOfferAvailability, setActiveWelcomeOfferAvailability] =
    useState(welcomeOfferAvailability);
  const [draftId, setDraftId] = useState<string | null>(() =>
    requestedDraftId && UuidSchema.safeParse(requestedDraftId).success
      ? requestedDraftId
      : null,
  );
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] =
    useState<DayToDuskAutosaveStatus>("not_saved");
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
  const stepRef = useRef<DayToDuskFormStep>(step);
  const shareEnabledRef = useRef(shareEnabled);
  const draftIdRef = useRef(draftId);
  const draftVersionRef = useRef(draftVersion);
  const uploadedDraftFilesRef = useRef(uploadedDraftFiles);
  const submittingRef = useRef(false);
  const savedFingerprintRef = useRef<string | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

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
    shareEnabledRef.current = shareEnabled;
  }, [shareEnabled]);
  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);
  useEffect(() => {
    draftVersionRef.current = draftVersion;
  }, [draftVersion]);
  useEffect(() => {
    uploadedDraftFilesRef.current = uploadedDraftFiles;
  }, [uploadedDraftFiles]);

  // Pending scroll action applied after a step transition renders. The
  // dashboard <main> (not the window) owns scrolling, so we target it.
  const pendingScrollRef = useRef<
    { type: "top" } | { type: "item"; index: number } | null
  >(null);

  useEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending) return;
    pendingScrollRef.current = null;
    const raf = requestAnimationFrame(() => {
      if (pending.type === "item") {
        scrollElementIntoViewWithinDashboard(dayToDuskItemDomId(pending.index));
      } else {
        scrollDashboardToTop();
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [step]);

  const uploadedFilesBySlot = useMemo(() => {
    const map = new Map<string, OrderDraftUploadedFileSummary>();
    for (const file of uploadedDraftFiles) {
      if (file.kind === "original") {
        map.set(buildDayToDuskDraftFileSlotKey(file.itemClientId), file);
      }
    }
    return map;
  }, [uploadedDraftFiles]);

  const buildDraftSource = useCallback(
    (
      nextItems = itemsRef.current,
      nextStep = stepRef.current,
      nextTerms = orderTermsRef.current,
      nextShareEnabled = shareEnabledRef.current,
    ): DayToDuskFormDraftSource => ({
      jobTitle: jobTitleRef.current,
      step: nextStep,
      items: nextItems,
      orderTerms: nextTerms,
      shareEnabled: nextShareEnabled,
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
      router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const persistDraft = useCallback(
    async (
      source: DayToDuskFormDraftSource,
      force = false,
    ): Promise<DraftSaveOutcome | null> => {
      if (!hasMeaningfulDayToDuskDraftChange(source)) return null;
      const fingerprint = buildDayToDuskDraftFingerprint(source);
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
        const result = await createOrderDraft(buildDayToDuskCreateDraftInput(source));
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
        buildDayToDuskUpdateDraftInput(source, currentVersion),
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
      const operation = saveQueueRef.current.then(() => persistDraft(source, force));
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
    if (!requestedDraftId || !requestedDraftIsValid) return;
    if (requestedDraftId === draftIdRef.current && resumeState === "ready") return;
    const controller = new AbortController();
    void getOrderDraft(requestedDraftId, controller.signal).then(async (result) => {
      if (!result.ok) {
        setDraftError(result.message);
        setResumeState("error");
        return;
      }
      const restored = validateDayToDuskDraftForResume(result.data);
      if (!restored.ok) {
        setDraftError(restored.message);
        setResumeState("error");
        return;
      }
      const restoredRegion = resolveDayToDuskDraftRegion(result.data);
      setRegion(restoredRegion);
      let restoredItems = restored.form.items as DayToDuskItemData[];
      const restoredReferences = await listDraftReferenceFiles(result.data.id);
      if (restoredReferences.ok) {
        restoredItems = restoredItems.map((item) => ({
          ...item,
          referenceFiles: restoredReferences.data.filter(
            (reference) => reference.itemClientId === item.clientItemId,
          ),
        }));
      }
      itemsRef.current = restoredItems;
      setItems(restoredItems);
      jobTitleRef.current = restored.form.jobTitle;
      setJobTitle(restored.form.jobTitle);
      orderTermsRef.current = restored.form.orderTerms;
      setOrderTerms(restored.form.orderTerms);
      stepRef.current = restored.form.step;
      setStep(restored.form.step);
      shareEnabledRef.current = restored.form.shareEnabled;
      setShareEnabled(restored.form.shareEnabled);
      draftIdRef.current = result.data.id;
      setDraftId(result.data.id);
      draftVersionRef.current = restored.version;
      setDraftVersion(restored.version);
      savedFingerprintRef.current = buildDayToDuskDraftFingerprint({
        jobTitle: restored.form.jobTitle,
        step: restored.form.step,
        items: restoredItems,
        orderTerms: restored.form.orderTerms,
        shareEnabled: restored.form.shareEnabled,
        currency: result.data.currency,
        region: restoredRegion,
      });
      await refreshDraftFiles(result.data.id);
      setSaveStatus("saved");
      setResumeState("ready");
    });
    return () => controller.abort();
  }, [
    refreshDraftFiles,
    requestedDraftId,
    requestedDraftIsValid,
    resumeState,
    setRegion,
  ]);

  useEffect(() => {
    if (resumeState !== "ready" || saveStatus === "conflict" || submitted) return;
    const source = buildDraftSource(items, step, orderTerms, shareEnabled);
    if (!hasMeaningfulDayToDuskDraftChange(source)) return;
    const timer = window.setTimeout(() => void enqueueDraftSave(source), 900);
    return () => window.clearTimeout(timer);
  }, [
    buildDraftSource,
    enqueueDraftSave,
    items,
    jobTitle,
    orderTerms,
    resumeState,
    saveStatus,
    shareEnabled,
    step,
    submitted,
  ]);

  const commitItems = (next: DayToDuskItemData[]) => {
    itemsRef.current = next;
    setItems(next);
  };

  // --- Item mutations (respecting the global share toggle) ---
  const handleItemChange = (index: number, data: DayToDuskItemData) => {
    const next = itemsRef.current.map((item, i) => (i === index ? data : item));
    commitItems(shareEnabledRef.current && index === 0 ? applySharedFrom(next, 0) : next);
  };

  const handleAddItem = () => {
    const fresh = emptyDayToDuskItem();
    const newItem =
      shareEnabledRef.current && itemsRef.current[0]
        ? { ...fresh, ...pickShared(itemsRef.current[0]) }
        : fresh;
    commitItems([...itemsRef.current, newItem]);
  };

  const handleRemoveItem = async (index: number) => {
    const item = itemsRef.current[index];
    if (!item) return;
    const currentDraftId = draftIdRef.current;
    const persistedOriginal = uploadedDraftFilesRef.current.find(
      (file) => file.kind === "original" && file.itemClientId === item.clientItemId,
    );
    if (currentDraftId && persistedOriginal) {
      const removed = await deleteOrderDraftFile(currentDraftId, persistedOriginal.id);
      if (!removed.ok) {
        setDraftError(removed.message);
        return;
      }
      const nextFiles = uploadedDraftFilesRef.current.filter(
        (file) => file.id !== persistedOriginal.id,
      );
      uploadedDraftFilesRef.current = nextFiles;
      setUploadedDraftFiles(nextFiles);
    }
    if (currentDraftId) {
      for (const reference of item.referenceFiles) {
        if (!reference.draftFileId) continue;
        const removed = await deleteDraftReferenceFile(currentDraftId, reference.id);
        if (!removed.ok) {
          setDraftError(removed.message);
          return;
        }
      }
    }
    let filtered = itemsRef.current.filter((_, i) => i !== index);
    if (shareEnabledRef.current && filtered.length > 0) {
      filtered = applySharedFrom(filtered, 0);
    }
    commitItems(filtered);
  };

  const handleShareToggle = (checked: boolean) => {
    shareEnabledRef.current = checked;
    setShareEnabled(checked);
    // On enable, immediately copy Photo #1 values to all photos. On
    // disable, retain the currently copied values (do not reset).
    if (checked) commitItems(applySharedFrom(itemsRef.current, 0));
  };

  const handleOriginalFileChange = useCallback(
    async (index: number, file: File | null) => {
      const item = itemsRef.current[index];
      if (!item) return;
      const slotKey = buildDayToDuskDraftFileSlotKey(item.clientItemId);
      const persisted = uploadedDraftFilesRef.current.find(
        (candidate) =>
          candidate.kind === "original" &&
          candidate.itemClientId === item.clientItemId,
      );
      if (!file) {
        if (draftIdRef.current && persisted) {
          setFileOperationStatus((current) => ({
            ...current,
            [slotKey]: "Removing saved file...",
          }));
          const removed = await deleteOrderDraftFile(
            draftIdRef.current,
            persisted.id,
          );
          if (!removed.ok) {
            setDraftError(removed.message);
            setFileOperationStatus((current) => {
              const next = { ...current };
              delete next[slotKey];
              return next;
            });
            return;
          }
          const nextFiles = uploadedDraftFilesRef.current.filter(
            (candidate) => candidate.id !== persisted.id,
          );
          uploadedDraftFilesRef.current = nextFiles;
          setUploadedDraftFiles(nextFiles);
        }
        const nextItems = itemsRef.current.map((candidate, candidateIndex) =>
          candidateIndex === index
            ? { ...candidate, file: null, originalFilename: null }
            : candidate,
        );
        commitItems(nextItems);
        setFileOperationStatus((current) => {
          const next = { ...current };
          delete next[slotKey];
          return next;
        });
        void enqueueDraftSave(buildDraftSource(nextItems), true);
        return;
      }

      const nextItems = itemsRef.current.map((candidate, candidateIndex) =>
        candidateIndex === index
          ? { ...candidate, file, originalFilename: file.name }
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
        kind: "original",
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
      if (!prepared.ok) {
        setDraftError(prepared.message);
      } else {
        const uploaded = await uploadPreparedOrderDraftFile(prepared.data, file);
        if (!uploaded.ok) {
          setDraftError(uploaded.message);
        } else {
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
                  candidate.kind !== "original" ||
                  candidate.itemClientId !== item.clientItemId,
              ),
              completed.data,
            ];
            uploadedDraftFilesRef.current = nextFiles;
            setUploadedDraftFiles(nextFiles);
          }
        }
      }
      setFileOperationStatus((current) => {
        const next = { ...current };
        delete next[slotKey];
        return next;
      });
    },
    [buildDraftSource, enqueueDraftSave],
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
          mimeType: reference.mimeType as
            | "image/jpeg"
            | "image/png"
            | "image/webp"
            | "application/pdf",
        });
        if (!prepared.ok) {
          setDraftError(prepared.message);
          continue;
        }
        const uploaded = await uploadPreparedDraftReferenceFile(
          prepared.data,
          reference.file,
        );
        if (!uploaded.ok) {
          setDraftError(uploaded.message);
          await deleteDraftReferenceFile(saved.draftId, reference.id);
          continue;
        }
        const completed = await completeDraftReferenceFile(
          saved.draftId,
          reference.id,
        );
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

  // --- Step transitions ---
  const goToReview = () => {
    if (Object.keys(fileOperationStatus).length > 0) return;
    setSubmitError("");
    pendingScrollRef.current = { type: "top" };
    stepRef.current = "review";
    setStep("review");
    void enqueueDraftSave(buildDraftSource(itemsRef.current, "review"), true);
  };

  const goToConfigureTop = () => {
    pendingScrollRef.current = { type: "top" };
    stepRef.current = "configure";
    setStep("configure");
  };

  const handleEditItem = (index: number) => {
    pendingScrollRef.current = { type: "item", index };
    stepRef.current = "configure";
    setStep("configure");
  };

  const resolvePersistedOriginal = async (
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
    const preview = await getOrderDraftFilePreview(currentDraftId, persisted.id);
    if (!preview.ok) throw new Error(preview.message);
    return fetchFile(preview.data.previewUrl);
  };

  // --- Final submission (Review step only) ---
  const handleSubmit = async () => {
    if (submittingRef.current || step !== "review") return;
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
      const files = await Promise.all(
        itemsRef.current.map(async (item) => {
          const persistedOriginal = uploadedFilesBySlot.get(
            buildDayToDuskDraftFileSlotKey(item.clientItemId),
          );
          const original =
            item.file ??
            (currentDraftId && persistedOriginal
              ? await resolvePersistedOriginal(currentDraftId, persistedOriginal)
              : null);
          if (!original) throw new Error("Every photo needs an original file.");
          const references = listedReferences?.ok
            ? listedReferences.data.filter(
                (reference) => reference.itemClientId === item.clientItemId,
              )
            : item.referenceFiles;
          const referenceFiles = await Promise.all(
            references.map(async (reference) => {
              if (reference.file) return reference.file;
              if (!reference.previewUrl) {
                throw new Error(
                  `Saved reference ${reference.filename} could not be loaded.`,
                );
              }
              const response = await fetch(reference.previewUrl, { cache: "no-store" });
              if (!response.ok) {
                throw new Error(
                  `Saved reference ${reference.filename} could not be loaded.`,
                );
              }
              return new File([await response.blob()], reference.filename, {
                type: reference.mimeType,
                lastModified: Date.now(),
              });
            }),
          );
          return { file: original, referenceFiles };
        }),
      );

      const itemsMetadata = itemsRef.current.map((item) => ({
        subService: DAY_TO_DUSK_SUB_SERVICE,
        selectedOptions: [DAY_TO_DUSK_OPTION_ID],
        fileSizeLimit: item.fileSizeLimit,
        disclaimerText: item.disclaimerText,
        additionalInfo: item.additionalInfo,
        referenceLink: item.referenceLink,
        duskStyle: item.duskStyle,
        turnOnInteriorLights: item.turnOnInteriorLights,
        turnOnExteriorLights: item.turnOnExteriorLights,
        addPoolLights: item.addPoolLights,
      }));
      const result = await submitOrder(
        "photo-editing",
        itemsMetadata,
        files,
        orderTermsRef.current,
        jobTitleRef.current,
        undefined,
        createPricingExpectation(
          calculateOrderQuote(
            {
              serviceType: "photo-editing",
              currency,
              items: itemsRef.current.map(() => ({
                selectedOptions: [DAY_TO_DUSK_OPTION_ID],
                baseOptionId: DAY_TO_DUSK_OPTION_ID,
                dedicatedSubService: DAY_TO_DUSK_SUB_SERVICE,
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
          dayToDuskAvailable: false,
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
            "day-to-dusk-free",
            result.currentPricingSnapshot,
          ),
        );
      }
      setSubmitError(result.error || "Submission failed. Please try again.");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Submission failed. Please try again.",
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleNewOrder = () => {
    setStep("configure");
    stepRef.current = "configure";
    const fresh = [emptyDayToDuskItem()];
    commitItems(fresh);
    setShareEnabled(false);
    shareEnabledRef.current = false;
    setJobTitle("");
    jobTitleRef.current = "";
    setOrderTerms(emptyOrderTerms);
    orderTermsRef.current = emptyOrderTerms;
    setSubmitted(false);
    setOrderId("");
    setOrderNumber("");
    setSubmitError("");
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

  // --- Validation ---
  const configureValid =
    items.length > 0 &&
    items.every(
      (item) =>
        Boolean(
          item.file ||
            uploadedFilesBySlot.get(
              buildDayToDuskDraftFileSlotKey(item.clientItemId),
            ),
        ) && normalizeReferenceLink(item.referenceLink) !== null,
    ) &&
    isJobTitleValid(jobTitle);
  const fileOperationActive = Object.keys(fileOperationStatus).length > 0;
  const reviewValid =
    configureValid &&
    orderTerms.accepted &&
    orderTerms.earlyPerformanceRequested &&
    !fileOperationActive;

  // --- Summary ---
  const summaryItems: SummaryItem[] = items.map((_, i) => ({
    label: `Photo #${i + 1}`,
  }));

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
            <h1 className="text-xl font-bold text-primary">Draft could not be restored</h1>
            <p className="mt-2 text-sm text-muted">{draftError}</p>
          </div>
        </Container>
      </section>
    );
  }

  if (submitted) {
    return (
      <section className="py-16 bg-surface">
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

  const isReview = step === "review";

  const sidebar = isReview ? (
    <OrderSummary
      serviceName={SERVICE_NAME}
      items={summaryItems}
      pricingInput={{
        serviceType: "photo-editing",
        items: items.map(() => ({
          selectedOptions: [DAY_TO_DUSK_OPTION_ID],
          baseOptionId: DAY_TO_DUSK_OPTION_ID,
          dedicatedSubService: "day-to-dusk",
        })),
      }}
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
      <p className="font-semibold text-foreground">Important</p>
      <p>
        For the best result, upload the highest-quality daytime exterior image
        available.
      </p>
      <p>Not sure which sky works best? Choose “Let Our Experts Decide”.</p>
      <p>
        Reference files are optional and can show a preferred sky, colour mood
        or visual direction.
      </p>
      <p>
        Reference files: JPG, JPEG, PNG, WebP or PDF. Up to 10 files, 20 MB each
        and 100 MB total.
      </p>
    </>
  );

  const guide = !isReview ? (
    <OrderGuideRail
      steps={DAY_TO_DUSK_GUIDE_STEPS}
      information={guideInformation}
    />
  ) : undefined;

  return (
    <OrderLayout
      title="Day to Dusk"
      subtitle="Transform daytime exterior photographs into warm, realistic twilight images with illuminated interiors and natural dusk skies."
      header={<OrderStepIndicator steps={STEPS} currentStepId={step} />}
      sidebar={sidebar}
      leadingRail={guide}
      editorial
      workspaceVariant={isReview ? undefined : "wide"}
    >
      {draftError ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-base leading-6 text-amber-900"
        >
          {draftError}
        </div>
      ) : null}

      <p className="text-sm text-muted" aria-live="polite">
        {saveStatus === "saving"
          ? "Saving draft..."
          : saveStatus === "saved"
            ? "Draft saved"
            : saveStatus === "save_failed"
              ? "Draft not saved"
              : ""}
      </p>

      {isReview ? (
        <DayToDuskReview
          jobTitle={jobTitle}
          items={items}
          orderTerms={orderTerms}
          onTermsChange={(next) => {
            orderTermsRef.current = next;
            setOrderTerms(next);
          }}
          onEditItem={handleEditItem}
          onBack={goToConfigureTop}
          submitError={submitError}
          welcomeOfferAvailability={activeWelcomeOfferAvailability}
        />
      ) : (
        <>
          {submitError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-800">
              {submitError}
            </div>
          )}

          <OrderJobTitleField
            value={jobTitle}
            onChange={(value) => {
              jobTitleRef.current = value;
              setJobTitle(value);
            }}
            comfortable
          />

          <div className="space-y-7">
            {items.map((item, index) => (
              <DayToDuskItemCard
                key={item.clientItemId}
                index={index}
                data={item}
                onChange={(data) => handleItemChange(index, data)}
                onRemove={() => void handleRemoveItem(index)}
                canRemove={items.length > 1}
                duskStyleImages={duskStyleImages}
                sharedLocked={shareEnabled && index > 0}
                persistedOriginal={uploadedFilesBySlot.get(
                  buildDayToDuskDraftFileSlotKey(item.clientItemId),
                )}
                onOriginalFileChange={(file) =>
                  void handleOriginalFileChange(index, file)
                }
                onRemovePersistedOriginal={() =>
                  void handleOriginalFileChange(index, null)
                }
                onReferenceFilesChange={(referenceFiles) =>
                  void handleReferenceFilesChange(index, referenceFiles)
                }
                originalOperationStatus={
                  fileOperationStatus[
                    buildDayToDuskDraftFileSlotKey(item.clientItemId)
                  ]
                }
                referenceOperationStatus={
                  fileOperationStatus[`${item.clientItemId}:references`]
                }
                fileOperationsDisabled={fileOperationActive}
              />
            ))}
          </div>

          {/* Single global Apply-to-All control — once, below the final
              photo card, only when there are 2+ photos. */}
          {items.length >= 2 && (
            <ApplyToAllPreferencesToggle
              checked={shareEnabled}
              onChange={handleShareToggle}
            />
          )}

          <button
            type="button"
            onClick={handleAddItem}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-4 text-base font-medium text-muted transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Plus className="h-5 w-5" aria-hidden />
            Add Another Photo
          </button>

          <OrderReviewAction
            onClick={goToReview}
            disabled={!configureValid || fileOperationActive}
          >
            <p className="max-w-xl text-sm leading-6 text-muted">
              Next, review every photo, selected option and the full estimated
              order total before submitting.
            </p>
          </OrderReviewAction>
        </>
      )}
    </OrderLayout>
  );
}
