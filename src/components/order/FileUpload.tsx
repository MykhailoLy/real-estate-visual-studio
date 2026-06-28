"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Upload, X, FileImage } from "lucide-react";
import { cn } from "@/lib/utils";

// Extensions that are safe to preview as a thumbnail in the browser even when
// the File object lacks a recognizable image/* MIME type (some browsers / OSes
// drop the MIME for files dragged from certain sources).
const PREVIEWABLE_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

/**
 * Decide whether a File should be shown as a thumbnail preview.
 * Trusts the MIME type first; falls back to extension matching.
 */
function isPreviewableImage(file: File): boolean {
  if (file.type && file.type.startsWith("image/")) return true;
  const lower = file.name.toLowerCase();
  return PREVIEWABLE_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// Public API kept identical to the previous implementation so callers don't change.
export type FileUploadAccept = Record<string, string[]>;

export interface PersistedFileDisplay {
  id: string;
  filename: string;
  fileSize: number;
  statusLabel?: string;
}

interface FileUploadProps {
  label: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: FileUploadAccept;
  maxSize?: number;
  required?: boolean;
  helperText?: string;
  persistedFile?: PersistedFileDisplay | null;
  operationStatusText?: string;
  operationErrorText?: string;
  retryLabel?: string;
  replaceLabel?: string;
  removePersistedLabel?: string;
  disabled?: boolean;
  retryDisabled?: boolean;
  removeDisabled?: boolean;
  onRetry?: () => void;
  onRemovePersisted?: () => void;
}

const DEFAULT_ACCEPT: FileUploadAccept = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

/**
 * Build a single comma-separated `accept` string for a native <input type="file">
 * from a MIME-type/extension map.
 *
 * Example:
 *   { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] }
 *   -> "image/jpeg,.jpg,.jpeg,image/png,.png"
 */
function buildAcceptString(accept: FileUploadAccept): string {
  const parts: string[] = [];
  for (const [mime, exts] of Object.entries(accept)) {
    parts.push(mime);
    for (const ext of exts) parts.push(ext);
  }
  return parts.join(",");
}

/**
 * Check if a File matches the accept map (by MIME type or by extension).
 */
function fileMatchesAccept(file: File, accept: FileUploadAccept): boolean {
  const acceptedMimes = Object.keys(accept);
  if (acceptedMimes.includes(file.type)) return true;

  const lowerName = file.name.toLowerCase();
  for (const exts of Object.values(accept)) {
    for (const ext of exts) {
      if (lowerName.endsWith(ext.toLowerCase())) return true;
    }
  }
  return false;
}

/**
 * File upload control with click-to-select and drag-and-drop.
 *
 * Implemented with native HTML5 file input + drag events instead of
 * react-dropzone, which avoids React 18-only peer-dep issues on React 19
 * and removes a common source of hydration / event-handler regressions.
 *
 * Public props match the previous implementation exactly so callers
 * (StagingItemCard, RenovationItemCard, FloorPlanItemCard,
 * PhotoEditItemCard) keep working without any changes.
 */
export default function FileUpload({
  label,
  file,
  onFileChange,
  accept = DEFAULT_ACCEPT,
  maxSize = 20 * 1024 * 1024,
  required = false,
  helperText,
  persistedFile,
  operationStatusText,
  operationErrorText,
  retryLabel = "Retry upload",
  replaceLabel = "Replace",
  removePersistedLabel = "Remove file",
  disabled = false,
  retryDisabled = false,
  removeDisabled = false,
  onRetry,
  onRemovePersisted,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();
  const labelId = `${inputId}-label`;
  const uploadActionId = `${inputId}-upload-action`;
  const maxSizeId = `${inputId}-max-size`;
  const helperTextId = helperText ? `${inputId}-helper` : undefined;
  const rejectedId = `${inputId}-error`;
  const operationStatusId = operationStatusText
    ? `${inputId}-operation-status`
    : undefined;
  const operationErrorId = operationErrorText
    ? `${inputId}-operation-error`
    : undefined;
  const [isDragActive, setIsDragActive] = useState(false);
  const [rejected, setRejected] = useState(false);

  // Local object URL for image previews. Derived from the current File via
  // useMemo so we avoid the "setState in useEffect" anti-pattern; an
  // accompanying effect revokes the URL when it changes or on unmount to
  // avoid memory leaks.
  const previewUrl = useMemo<string | null>(() => {
    if (!file || !isPreviewableImage(file)) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const acceptString = buildAcceptString(accept);

  const handleFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return;
      const candidate = files[0];
      if (!candidate) return;

      if (candidate.size > maxSize) {
        setRejected(true);
        return;
      }
      if (!fileMatchesAccept(candidate, accept)) {
        setRejected(true);
        return;
      }

      setRejected(false);
      onFileChange(candidate);
    },
    [accept, maxSize, onFileChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Allow re-selecting the same file later
    e.target.value = "";
  };

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const onDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (!isDragActive) setIsDragActive(true);
  };

  const onDragEnter = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const onDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragActive(false);
    handleFiles(e.dataTransfer?.files ?? null);
  };

  const removeFile = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setRejected(false);
    onFileChange(null);
  };

  const describedBy = [
    helperTextId,
    !file ? maxSizeId : undefined,
    operationStatusId,
    operationErrorId,
    rejected ? rejectedId : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <label
        id={labelId}
        htmlFor={inputId}
        className="block text-sm font-medium text-foreground mb-1.5"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {helperText && (
        <p id={helperTextId} className="text-xs text-foreground/75 mb-2">
          {helperText}
        </p>
      )}

      {/* Hidden file input — always rendered so click + keyboard pickers work
          regardless of the visible state. */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={acceptString}
        className="hidden"
        onChange={handleInputChange}
        tabIndex={-1}
      />

      {file ? (
        <div className="flex items-stretch gap-3 p-3 bg-surface border border-border rounded-lg">
          {previewUrl ? (
            // Local-File preview. Plain <img> is intentional: next/image needs
            // a static or remote URL, while object URLs are short-lived blobs.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={file.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-md object-cover bg-stone-100 flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-md bg-stone-100 flex items-center justify-center flex-shrink-0">
              <FileImage className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <p className="text-sm font-medium text-foreground truncate">
              {file.name}
            </p>
            <p className="text-xs text-foreground/75">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
            {operationStatusText && (
              <p
                id={operationStatusId}
                aria-live="polite"
                className="mt-1 text-xs text-foreground/75"
              >
                {operationStatusText}
              </p>
            )}
            {operationErrorText && (
              <p
                id={operationErrorId}
                role="alert"
                className="mt-1 text-xs text-red-700"
              >
                {operationErrorText}
              </p>
            )}
          </div>
          {onRetry && operationErrorText && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retryDisabled}
              className="flex-shrink-0 self-start rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {retryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={removeFile}
            disabled={disabled}
            className="flex-shrink-0 self-start p-1 text-muted hover:text-red-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Remove file"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      ) : persistedFile ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-stretch">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md bg-white sm:h-20 sm:w-20">
            <FileImage className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {persistedFile.filename}
            </p>
            <p className="text-xs text-foreground/75">
              {formatFileSize(persistedFile.fileSize)}
            </p>
            <p className="mt-1 text-xs font-medium text-primary">
              {persistedFile.statusLabel ?? "Saved in draft"}
            </p>
            <div
              id={operationStatusId}
              aria-live="polite"
              className="mt-1 min-h-4 text-xs text-foreground/75"
            >
              {operationStatusText}
            </div>
            {operationErrorText && (
              <p
                id={operationErrorId}
                role="alert"
                className="mt-1 text-xs text-red-700"
              >
                {operationErrorText}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled}
              className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
              {replaceLabel}
            </button>
            {onRetry && operationErrorText && (
              <button
                type="button"
                onClick={onRetry}
                disabled={retryDisabled}
                className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {retryLabel}
              </button>
            )}
            {onRemovePersisted && (
              <button
                type="button"
                onClick={onRemovePersisted}
                disabled={removeDisabled}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {removePersistedLabel}
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          aria-labelledby={`${labelId} ${uploadActionId}`}
          aria-describedby={describedBy || undefined}
          onClick={openPicker}
          onDragOver={onDragOver}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          disabled={disabled}
          className={cn(
            "w-full border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all select-none",
            disabled && "cursor-not-allowed opacity-60",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-surface"
          )}
        >
          <Upload
            className="w-8 h-8 text-foreground/70 mx-auto mb-2"
            aria-hidden="true"
          />
          <span
            id={uploadActionId}
            className="block text-sm text-foreground font-medium"
          >
            {isDragActive ? "Drop file here" : "Click or drag to upload"}
          </span>
          <span id={maxSizeId} className="block text-xs text-foreground/75 mt-1">
            Max {Math.round(maxSize / 1024 / 1024)}MB
          </span>
        </button>
      )}

      {rejected && (
        <p id={rejectedId} role="alert" className="text-xs text-red-700 mt-1">
          File rejected. Please check format and size.
        </p>
      )}
      {!persistedFile && operationStatusText && (
        <p
          id={operationStatusId}
          aria-live="polite"
          className="mt-1 text-xs text-foreground/75"
        >
          {operationStatusText}
        </p>
      )}
      {!persistedFile && operationErrorText && (
        <p id={operationErrorId} role="alert" className="mt-1 text-xs text-red-700">
          {operationErrorText}
        </p>
      )}
    </div>
  );
}

function formatFileSize(size: number): string {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}
