"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  createOrderDraft,
  getOrderDraft,
  isOrderDraftVersionConflict,
  updateOrderDraft,
} from "@/lib/order-drafts/client";
import { UuidSchema } from "@/lib/order-drafts/schema";
import { stableStringifyJson } from "@/lib/order-drafts/serialization";
import {
  buildVirtualStagingCreateDraftInput,
  buildVirtualStagingUpdateDraftInput,
  hasMeaningfulVirtualStagingDraftChange,
  isVirtualStagingFinalSubmissionReady,
  mapVirtualStagingFormToDraftState,
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

export default function VirtualStagingOrderForm({
  clientEmail,
  orderRoute,
}: VirtualStagingOrderFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [region] = useDisplayRegion();
  const currency = currencyForRegion(region);
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
  const [showResumedFileNotice, setShowResumedFileNotice] = useState(false);
  const [conflictMessage, setConflictMessage] = useState("");

  const draftIdRef = useRef(draftId);
  const draftVersionRef = useRef(draftVersion);
  const savedSerializedRef = useRef<string | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const isRestoringRef = useRef(resumeState === "loading");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const setDraftQueryParam = useCallback(
    (nextDraftId: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("draft", nextDraftId);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const saveDraftNow = useCallback(
    (options: { force?: boolean } = {}) => {
      const run = async (): Promise<boolean> => {
        if (isRestoringRef.current || resumeState === "loading") return false;
        if (!options.force && !hasMeaningfulDraft) return true;
        if (saveStatus === "conflict") return false;

        const state = mapVirtualStagingFormToDraftState(draftSource);
        const serialized = stableStringifyJson(state);
        if (!options.force && savedSerializedRef.current === serialized) {
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
          if (!result.ok) {
            setSaveStatus("save_failed");
            setDraftError(result.message);
            return false;
          }
          draftIdRef.current = result.data.id;
          draftVersionRef.current = result.data.version;
          setDraftId(result.data.id);
          setDraftVersion(result.data.version);
          savedSerializedRef.current = serialized;
          setDraftQueryParam(result.data.id);
          setSaveStatus("saved");
          return true;
        }

        const expectedVersion = draftVersionRef.current;
        if (!expectedVersion) {
          setSaveStatus("save_failed");
          setDraftError("Draft version is not ready yet.");
          return false;
        }

        const result = await updateOrderDraft(
          currentDraftId,
          buildVirtualStagingUpdateDraftInput(draftSource, expectedVersion),
        );
        if (!result.ok) {
          if (isOrderDraftVersionConflict(result)) {
            setSaveStatus("conflict");
            setConflictMessage(
              "This draft changed in another tab. Reload latest draft or keep editing without autosave.",
            );
            return false;
          }
          setSaveStatus("save_failed");
          setDraftError(result.message);
          return false;
        }

        draftVersionRef.current = result.data.version;
        setDraftVersion(result.data.version);
        savedSerializedRef.current = serialized;
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
      savedSerializedRef.current !== null &&
      !isRestoringRef.current
    ) {
      return;
    }

    const controller = new AbortController();
    window.queueMicrotask(() => {
      setResumeState("loading");
      setDraftError("");
    });
    isRestoringRef.current = true;

    getOrderDraft(requestedDraftId, controller.signal)
      .then((result) => {
        if (!result.ok) {
          if (result.status === 401) {
            setResumeState("error");
            setDraftError("Please sign in again to restore this draft.");
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
        setDraftId(result.data.id);
        setDraftVersion(resume.version);
        draftIdRef.current = result.data.id;
        draftVersionRef.current = resume.version;
        savedSerializedRef.current = stableStringifyJson(resume.state);
        setShowResumedFileNotice(
          resume.form.items.some((item) => item.needsOriginalFileReselection),
        );
        setSaveStatus("saved");
        setResumeState("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResumeState("error");
        setDraftError("Draft could not be restored. Please try again.");
      })
      .finally(() => {
        isRestoringRef.current = false;
      });

    return () => controller.abort();
  }, [searchParams]);

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
    setDraftVersion(resume.version);
    draftVersionRef.current = resume.version;
    savedSerializedRef.current = stableStringifyJson(resume.state);
    setShowResumedFileNotice(
      resume.form.items.some((item) => item.needsOriginalFileReselection),
    );
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

  const handleNewOrder = () => {
    setItems([emptyStagingItem()]);
    setJobTitle("");
    setOrderTerms(emptyOrderTerms);
    setSubmitted(false);
    setOrderNumber("");
    setSubmitError("");
  };

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
            Restoring your draft...
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
              {resumeState === "not_found" ? "Draft not found" : "Draft could not be restored"}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {draftError ||
                "This draft may have expired, been deleted, or belongs to another account."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/dashboard/orders/new/virtual-staging"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light"
              >
                Start a new Virtual Staging order
              </Link>
              {resumeState === "error" && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </Container>
      </section>
    );
  }

  const saveStatusLabel = {
    not_saved: "Not saved yet",
    saving: "Saving...",
    saved: "Saved",
    save_failed: "Save failed",
    conflict: "Changed in another tab",
  } satisfies Record<VirtualStagingAutosaveStatus, string>;

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
            Draft
          </p>
          <p className="text-sm font-medium text-foreground">
            {saveStatusLabel[saveStatus]}
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
          Save and exit
        </button>
      </div>

      {showResumedFileNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Your draft settings were restored. Uploaded images are not saved yet, so please select the required files again.
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
              Reload latest draft
            </button>
            <button
              type="button"
              onClick={() =>
                setConflictMessage(
                  "Keep editing is active. Autosave is paused until you reload the latest draft.",
                )
              }
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50"
            >
              Keep editing
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
            key={index}
            index={index}
            data={item}
            onChange={(data) => handleItemChange(index, data)}
            onRemove={() => handleRemoveItem(index)}
            canRemove={items.length > 1}
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
