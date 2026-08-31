"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  Paperclip,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { ReviewStatus } from "@/lib/client-reviews";
import {
  REWORK_REFERENCES_MAX_FILES,
  REWORK_REFERENCE_MAX_BYTES,
  REWORK_REFERENCE_MAX_MB,
  isAllowedReworkReferenceMimeType,
} from "@/lib/rework-references-config";
import { formatBytes } from "@/lib/display/file-format";
import { getReviewStatusLabel } from "@/lib/display/status-labels";

interface Props {
  deliverableId: string;
  initialReviewStatus: ReviewStatus | null;
  initialComment?: string | null;
  filename?: string;
  presentation?: "default" | "compact";
}

type BadgeVariant = "green" | "amber" | "blue";

interface BadgeCfg {
  label: string;
  variant: BadgeVariant;
  icon: React.ReactNode;
}

interface SelectedReferenceFile {
  id: string;
  file: File;
}

interface ReviewResponse {
  ok?: boolean;
  error?: string;
  review?: {
    id?: string;
    status: ReviewStatus;
    comment: string | null;
  };
}

interface UploadUrlResponse {
  ok?: boolean;
  signedUrl?: string;
  file?: {
    id: string;
    filename: string;
    file_size: number;
    mime_type: string;
    created_at: string;
  };
  error?: string;
}

const STATUS_BADGE: Partial<Record<ReviewStatus, BadgeCfg>> = {
  approved: {
    label: getReviewStatusLabel("approved"),
    variant: "green",
    icon: <CheckCircle2 className="w-3 h-3" aria-hidden />,
  },
  rework_requested: {
    label: getReviewStatusLabel("rework_requested"),
    variant: "amber",
    icon: <RotateCcw className="w-3 h-3" aria-hidden />,
  },
  rework_in_progress: {
    label: getReviewStatusLabel("rework_in_progress"),
    variant: "blue",
    icon: <Clock className="w-3 h-3" aria-hidden />,
  },
  resolved: {
    label: getReviewStatusLabel("resolved"),
    variant: "green",
    icon: <CheckCircle2 className="w-3 h-3" aria-hidden />,
  },
};

const V: Record<BadgeVariant, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50  text-amber-700  border-amber-200",
  blue: "bg-blue-50   text-blue-700   border-blue-200",
};

export default function DeliverableReviewActions({
  deliverableId,
  initialReviewStatus,
  initialComment,
  filename,
  presentation = "default",
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ReviewStatus | null>(
    initialReviewStatus ?? null,
  );
  const [comment, setComment] = useState<string | null>(initialComment ?? null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState<"rework" | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedReferenceFile[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [referenceFileCount, setReferenceFileCount] = useState<number | null>(null);

  const fileLabel = filename ? `"${filename}"` : "this file";
  const canRequestRework =
    status !== "rework_requested" && status !== "rework_in_progress";
  const badgeCfg = status !== null ? (STATUS_BADGE[status] ?? null) : null;
  const isCompact = presentation === "compact";

  async function submitRework(text: string, files: SelectedReferenceFile[]) {
    setApiError(null);
    setUploadWarning(null);
    setUploadStatus(null);
    setLoading("rework");

    try {
      const res = await fetch(`/api/client/deliverables/${deliverableId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "rework_requested", comment: text }),
      });
      const data = (await res.json()) as ReviewResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Request failed.");
      }
      if (!data.review) {
        throw new Error("Review response was incomplete.");
      }

      let uploadedCount = 0;
      let failedCount = 0;

      if (files.length > 0) {
        if (!data.review.id) {
          failedCount = files.length;
        } else {
          for (let index = 0; index < files.length; index++) {
            const selected = files[index];
            setUploadStatus(
              `Uploading ${index + 1} of ${files.length} reference files...`,
            );
            try {
              await uploadReferenceFile(data.review.id, selected.file);
              uploadedCount++;
            } catch (err) {
              failedCount++;
              console.warn("[DeliverableReviewActions] Reference upload failed:", err);
            }
          }
        }
      }

      setStatus(data.review.status);
      setComment(data.review.comment ?? null);
      setReferenceFileCount(uploadedCount > 0 ? uploadedCount : null);
      if (failedCount > 0) {
        setUploadWarning(
          `Rework requested, but ${failedCount} reference file${failedCount !== 1 ? "s" : ""} failed to upload.`,
        );
      }
      setShowForm(false);
      setDraft("");
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(null);
      setUploadStatus(null);
    }
  }

  function handleSubmitRework() {
    const text = draft.trim();
    if (text.length < 10) {
      setFormError("Min 10 characters.");
      return;
    }
    if (text.length > 1000) {
      setFormError("Max 1000 characters.");
      return;
    }
    setFormError(null);
    void submitRework(text, selectedFiles);
  }

  function handleSelectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (nextFiles.length === 0) return;

    const validation = validateSelectedFiles(nextFiles, selectedFiles.length);
    setSelectedFiles((prev) => [...prev, ...validation.valid]);
    setFormError(validation.error);
  }

  function removeSelectedFile(id: string) {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== id));
    setFormError(null);
  }

  function resetForm() {
    setShowForm(false);
    setFormError(null);
    setDraft("");
    setSelectedFiles([]);
    setUploadStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      {status === "rework_delivered" && (
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1.5">
          <Sparkles className="w-3 h-3 flex-shrink-0" aria-hidden />
          {getReviewStatusLabel("rework_delivered")}
        </div>
      )}

      {badgeCfg && (
        <div className="flex flex-col gap-1">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold border rounded-full px-2.5 py-1 ${V[badgeCfg.variant]}`}
          >
            {badgeCfg.icon}
            {badgeCfg.label}
          </span>
          {status === "rework_requested" && comment && (
            <div className="space-y-1">
              <p
                className="text-[10px] text-muted leading-snug max-w-[200px] truncate"
                title={comment}
              >
                <MessageSquare
                  className="inline w-2.5 h-2.5 mr-0.5 -mt-px"
                  aria-hidden
                />
                {comment}
              </p>
              {referenceFileCount !== null && referenceFileCount > 0 && (
                <p className="inline-flex items-center gap-1 text-[10px] text-muted">
                  <Paperclip className="w-2.5 h-2.5" aria-hidden />
                  {referenceFileCount} reference file
                  {referenceFileCount !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {canRequestRework && !showForm && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setFormError(null);
              setDraft("");
              setApiError(null);
              setUploadWarning(null);
            }}
            disabled={loading !== null}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-60 ${
              isCompact
                ? "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
                : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
            aria-label={`Request rework for ${fileLabel}`}
          >
            <RotateCcw className="w-3 h-3" aria-hidden />
            Request rework
          </button>
          {!isCompact && (
            <p className="text-[10px] text-muted leading-snug">
              Need changes? Request a rework for this file.
            </p>
          )}
        </div>
      )}

      {showForm && (
        <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-3 space-y-2.5 w-full max-w-sm">
          <p className="text-[11px] font-semibold text-foreground">
            Describe what needs to change:
          </p>
          <textarea
            rows={3}
            maxLength={1000}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (formError) setFormError(null);
            }}
            disabled={loading === "rework"}
            placeholder="e.g. The lighting feels too dark on the left side..."
            className="w-full text-[12px] border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 disabled:opacity-60 bg-white"
            aria-label="Rework request comment"
          />
          <span className="text-[10px] text-muted tabular-nums">
            {draft.length}/1000
          </span>

          <div className="rounded-lg border border-amber-200/70 bg-white/70 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold text-foreground">
                  Attach reference files
                </p>
                <p className="text-[10px] text-muted leading-snug">
                  Optional images or PDFs, up to {REWORK_REFERENCES_MAX_FILES} files.
                </p>
              </div>
              <input
                ref={fileInputRef}
                id={`rework-reference-files-${deliverableId}`}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                className="sr-only"
                disabled={loading === "rework"}
                onChange={handleSelectFiles}
              />
              <label
                htmlFor={`rework-reference-files-${deliverableId}`}
                className="inline-flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg text-[11px] font-semibold text-foreground/70 hover:text-primary hover:border-primary/40 bg-white transition-colors"
              >
                <Paperclip className="w-3 h-3" aria-hidden />
                Choose files
              </label>
            </div>

            {selectedFiles.length > 0 && (
              <ul className="space-y-1.5">
                {selectedFiles.map(({ id, file }) => (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-white px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold text-foreground">
                        {file.name}
                      </p>
                      <p className="text-[10px] text-muted">
                        {formatBytes(file.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSelectedFile(id)}
                      disabled={loading === "rework"}
                      className="p-1 rounded-md text-muted hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      aria-label={`Remove ${file.name}`}
                    >
                      <Trash2 className="w-3 h-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {formError && (
            <p className="flex items-center gap-1 text-[11px] text-red-600">
              <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden />
              {formError}
            </p>
          )}
          {uploadStatus && (
            <p className="flex items-center gap-1 text-[11px] text-amber-800">
              <Loader2 className="w-3 h-3 flex-shrink-0 animate-spin" aria-hidden />
              {uploadStatus}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmitRework}
              disabled={loading === "rework"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-[11px] font-semibold hover:bg-amber-700 transition-colors shadow-sm disabled:opacity-60"
            >
              {loading === "rework" ? (
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
              ) : (
                <Send className="w-3 h-3" aria-hidden />
              )}
              {loading === "rework" ? "Submitting..." : "Submit rework request"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={loading === "rework"}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg text-[11px] font-semibold text-foreground/60 hover:text-foreground bg-white transition-colors disabled:opacity-60"
            >
              <X className="w-3 h-3" aria-hidden />
              Cancel
            </button>
          </div>
        </div>
      )}

      {apiError && (
        <p className="flex items-center gap-1 text-[11px] text-red-600 mt-0.5">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden />
          {apiError}
        </p>
      )}
      {uploadWarning && (
        <p className="flex items-start gap-1 text-[11px] text-amber-700 mt-0.5 max-w-[240px] leading-snug">
          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" aria-hidden />
          {uploadWarning}
        </p>
      )}
    </div>
  );
}

function validateSelectedFiles(
  files: File[],
  existingCount: number,
): { valid: SelectedReferenceFile[]; error: string | null } {
  const valid: SelectedReferenceFile[] = [];
  const errors: string[] = [];
  const remainingSlots = REWORK_REFERENCES_MAX_FILES - existingCount;

  if (remainingSlots <= 0) {
    return {
      valid,
      error: `Maximum ${REWORK_REFERENCES_MAX_FILES} reference files per rework request.`,
    };
  }

  for (const file of files.slice(0, remainingSlots)) {
    if (!isAllowedReworkReferenceMimeType(file.type)) {
      errors.push(`${file.name}: unsupported file type.`);
      continue;
    }
    if (file.size > REWORK_REFERENCE_MAX_BYTES) {
      errors.push(`${file.name}: max ${REWORK_REFERENCE_MAX_MB} MB.`);
      continue;
    }
    valid.push({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
    });
  }

  if (files.length > remainingSlots) {
    errors.push(
      `Only ${remainingSlots} more file${remainingSlots !== 1 ? "s" : ""} can be attached.`,
    );
  }

  return {
    valid,
    error: errors.length > 0 ? errors.join(" ") : null,
  };
}

async function uploadReferenceFile(reviewId: string, file: File): Promise<void> {
  const uploadUrlRes = await fetch(
    `/api/client/reviews/${reviewId}/reference-files/upload-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        filename: file.name,
        content_type: file.type,
        file_size: file.size,
      }),
    },
  );

  const uploadUrlData = (await uploadUrlRes.json().catch(() => ({}))) as UploadUrlResponse;
  if (
    !uploadUrlRes.ok ||
    !uploadUrlData.ok ||
    !uploadUrlData.signedUrl ||
    !uploadUrlData.file?.id
  ) {
    throw new Error(uploadUrlData.error ?? "Could not prepare reference file upload.");
  }

  const putRes = await fetch(uploadUrlData.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`Storage upload failed for ${file.name}.`);
  }

  const completeRes = await fetch(
    `/api/client/reviews/${reviewId}/reference-files/${uploadUrlData.file.id}/complete`,
    {
      method: "POST",
      credentials: "same-origin",
    },
  );
  const completeData = (await completeRes.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  if (!completeRes.ok || !completeData.ok) {
    throw new Error(completeData.error ?? "Could not confirm reference file upload.");
  }
}
