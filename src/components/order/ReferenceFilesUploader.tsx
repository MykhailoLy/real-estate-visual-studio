"use client";

import { Upload, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import ReferenceFileThumbnail from "@/components/order/ReferenceFileThumbnail";
import { cn } from "@/lib/utils";
import {
  MAX_REFERENCE_FILES,
  MAX_REFERENCE_TOTAL_SIZE_BYTES,
  REFERENCE_FILE_ACCEPT,
  appendReferenceFiles,
  formatReferenceFileSize,
  referenceFilesTotalSize,
  type ReferenceFileValue,
} from "@/lib/reference-files";

interface ReferenceFilesUploaderProps {
  files: ReferenceFileValue[];
  onChange: (files: ReferenceFileValue[]) => void;
  disabled?: boolean;
  operationStatus?: string;
  /** Larger typography for wide, editorial order forms. */
  comfortable?: boolean;
}

const HELPER =
  "Upload examples, marked screenshots, plans, company logos or other files that explain the required result. Up to 10 files.";
const ORDER_HELPER =
  "If a reference applies to every photo in this order, explain how it should be used in Additional Instructions.";

export default function ReferenceFilesUploader({
  files,
  onChange,
  disabled = false,
  operationStatus,
  comfortable = false,
}: ReferenceFilesUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const total = useMemo(() => referenceFilesTotalSize(files), [files]);
  const addFiles = (selection: FileList | File[]) => {
    const result = appendReferenceFiles(files, Array.from(selection));
    setErrors(result.errors);
    if (result.accepted.length !== files.length) onChange(result.accepted);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (id: string) => {
    const removedIndex = files.findIndex((file) => file.id === id);
    const remaining = files.filter((file) => file.id !== id);
    const focusId =
      remaining[Math.min(Math.max(removedIndex, 0), remaining.length - 1)]?.id;
    onChange(remaining);
    setErrors([]);
    requestAnimationFrame(() => {
      if (focusId) {
        document
          .querySelector<HTMLElement>(`[data-reference-remove="${focusId}"]`)
          ?.focus();
      } else {
        inputRef.current?.focus();
      }
    });
  };

  return (
    <section className="relative space-y-3" aria-labelledby={`${inputId}-label`}>
      <div>
        <p
          id={`${inputId}-label`}
          className={cn(
            "font-medium text-foreground",
            comfortable ? "text-base" : "text-sm",
          )}
        >
          Reference Files (optional)
        </p>
        <p
          className={cn(
            "mt-1 leading-relaxed text-muted",
            comfortable ? "text-sm" : "text-xs",
          )}
        >
          {HELPER}
        </p>
        <p
          className={cn(
            "mt-1 leading-relaxed text-muted",
            comfortable ? "text-sm" : "text-xs",
          )}
        >
          {ORDER_HELPER}
        </p>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={REFERENCE_FILE_ACCEPT}
        disabled={disabled}
        className="peer sr-only"
        onChange={(event) => event.target.files && addFiles(event.target.files)}
      />
      <label
        htmlFor={inputId}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) addFiles(event.dataTransfer.files);
        }}
        className={`flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 ${
          disabled
            ? "cursor-not-allowed border-border bg-surface/60 opacity-60"
            : dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-surface/50"
        }`}
      >
        <Upload className="mb-2 h-5 w-5 text-muted" aria-hidden />
        <span
          className={cn(
            "font-medium text-foreground",
            comfortable ? "text-base" : "text-sm",
          )}
        >
          Choose files or drag and drop
        </span>
        <span className={cn("mt-1 text-muted", comfortable ? "text-sm" : "text-xs")}>
          JPG, JPEG, PNG, WebP or PDF
        </span>
      </label>

      <p
        className={cn(
          "font-medium text-muted",
          comfortable ? "text-sm" : "text-xs",
        )}
        aria-live="polite"
      >
        {files.length} of {MAX_REFERENCE_FILES} files · {formatReferenceFileSize(total)} of{" "}
        {formatReferenceFileSize(MAX_REFERENCE_TOTAL_SIZE_BYTES)}
      </p>

      {errors.length > 0 && (
        <div className="space-y-1" role="alert">
          {errors.map((error) => (
            <p
              key={error}
              className={cn(
                "font-medium text-red-700",
                comfortable ? "text-sm" : "text-xs",
              )}
            >
              {error}
            </p>
          ))}
        </div>
      )}
      {operationStatus && (
        <p
          className={cn("text-muted", comfortable ? "text-sm" : "text-xs")}
          aria-live="polite"
        >
          {operationStatus}
        </p>
      )}

      {files.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Selected reference files">
          {files.map((reference) => {
            return (
              <li
                key={reference.id}
                className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-white p-2.5"
              >
                <ReferenceFileThumbnail
                  reference={reference}
                  className="h-12 w-12 rounded-md"
                  iconClassName="h-5 w-5"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "break-all font-medium text-foreground",
                      comfortable ? "text-sm" : "text-xs",
                    )}
                  >
                    {reference.filename}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {formatReferenceFileSize(reference.fileSize)}
                  </p>
                </div>
                <button
                  type="button"
                  data-reference-remove={reference.id}
                  onClick={() => removeFile(reference.id)}
                  disabled={disabled}
                  className="flex-none rounded-md p-2 text-muted hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  aria-label={`Remove reference ${reference.filename}`}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
