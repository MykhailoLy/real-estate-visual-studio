"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Upload, X, FileImage } from "lucide-react";
import { cn } from "@/lib/utils";
import { useViewerScrollLock } from "@/components/media/useViewerScrollLock";
import { NativeStaticImageStage } from "@/components/media/StaticImageStage";
import type { StaticImageViewerVariant } from "@/components/media/static-image-variant";

// Extensions that are safe to preview as a thumbnail in the browser even when
// the File object lacks a recognizable image/* MIME type (some browsers / OSes
// drop the MIME for files dragged from certain sources).
const PREVIEWABLE_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

function isPreviewableImageFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return PREVIEWABLE_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Decide whether a File should be shown as a thumbnail preview.
 * Trusts the MIME type first; falls back to extension matching.
 */
export function isPreviewableUploadImage(file: File): boolean {
  if (file.type && file.type.startsWith("image/")) return true;
  return isPreviewableImageFilename(file.name);
}

// Public API kept identical to the previous implementation so callers don't change.
export type FileUploadAccept = Record<string, string[]>;

export interface PersistedFileDisplay {
  id: string;
  filename: string;
  fileSize: number;
  statusLabel?: string;
  previewUrl?: string | null;
  previewExpiresAt?: string | null;
}

export function hasFileUploadPreview(
  file: File | null,
  persistedFile?: Pick<PersistedFileDisplay, "filename" | "previewUrl"> | null,
): boolean {
  if (file) return isPreviewableUploadImage(file);
  return Boolean(
    persistedFile?.previewUrl &&
      isPreviewableImageFilename(persistedFile.filename),
  );
}

interface FileUploadProps {
  viewerVariant: StaticImageViewerVariant;
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
  validationError?: string;
  validationFieldId?: string;
  retryLabel?: string;
  replaceLabel?: string;
  removePersistedLabel?: string;
  disabled?: boolean;
  retryDisabled?: boolean;
  removeDisabled?: boolean;
  onRetry?: () => void;
  onRemovePersisted?: () => void;
  /** Day-to-Dusk-sized labels and supporting copy; defaults to compact. */
  comfortable?: boolean;
  /** Stable input id for a related external preview or action. */
  inputId?: string;
  /**
   * Keeps selected-file chrome compact when a larger preview is rendered by
   * the surrounding workspace. Empty uploads still use the full drop zone.
   */
  presentationVariant?: "default" | "workspace";
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
  viewerVariant,
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
  validationError,
  validationFieldId,
  retryLabel = "Retry upload",
  replaceLabel = "Replace",
  removePersistedLabel = "Remove file",
  disabled = false,
  retryDisabled = false,
  removeDisabled = false,
  onRetry,
  onRemovePersisted,
  comfortable = false,
  inputId: inputIdProp,
  presentationVariant = "default",
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const generatedInputId = useId();
  const inputId = inputIdProp ?? generatedInputId;
  const labelId = `${inputId}-label`;
  const uploadActionId = `${inputId}-upload-action`;
  const maxSizeId = `${inputId}-max-size`;
  const helperTextId = helperText ? `${inputId}-helper` : undefined;
  const rejectedId = `${inputId}-error`;
  const validationErrorId = validationError
    ? `${inputId}-validation-error`
    : undefined;
  const operationStatusId = operationStatusText
    ? `${inputId}-operation-status`
    : undefined;
  const operationErrorId = operationErrorText
    ? `${inputId}-operation-error`
    : undefined;
  const [isDragActive, setIsDragActive] = useState(false);
  const [rejected, setRejected] = useState(false);
  const isEmptyUploadState = file === null && persistedFile == null;
  const isWorkspacePresentation = presentationVariant === "workspace";

  // Local object URL for image previews. Derived from the current File via
  // useMemo so we avoid the "setState in useEffect" anti-pattern; an
  // accompanying effect revokes the URL when it changes or on unmount to
  // avoid memory leaks.
  const previewUrl = useMemo<string | null>(() => {
    if (!file || !isPreviewableUploadImage(file)) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const persistedImagePreviewUrl =
    persistedFile?.previewUrl &&
    isPreviewableImageFilename(persistedFile.filename)
      ? persistedFile.previewUrl
      : null;
  const workspacePreviewUrl = isWorkspacePresentation
    ? (previewUrl ?? (!file ? persistedImagePreviewUrl : null))
    : null;
  const workspacePreviewFilename =
    file?.name ?? persistedFile?.filename ?? null;

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
    [accept, maxSize, onFileChange],
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
    isEmptyUploadState ? maxSizeId : undefined,
    isEmptyUploadState ? operationStatusId : undefined,
    isEmptyUploadState ? operationErrorId : undefined,
    rejected ? rejectedId : undefined,
    validationErrorId,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      id={validationFieldId}
      role="group"
      aria-labelledby={labelId}
      aria-describedby={validationErrorId}
    >
      <label
        id={labelId}
        htmlFor={inputId}
        className={cn(
          "mb-1.5 block font-medium text-foreground",
          comfortable ? "text-base" : "text-sm",
          isWorkspacePresentation && !isEmptyUploadState && "sr-only",
        )}
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {helperText && (
        <p
          id={helperTextId}
          className={cn(
            "mb-2 text-foreground/75",
            comfortable ? "text-sm leading-6" : "text-dashboard-metadata",
          )}
        >
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
        required={required}
        aria-invalid={validationError ? true : undefined}
        aria-describedby={validationErrorId}
      />

      {file ? (
        <div className={isWorkspacePresentation ? "space-y-3" : undefined}>
          {workspacePreviewUrl && workspacePreviewFilename ? (
            <WorkspaceImagePreview
              key={workspacePreviewUrl}
              src={workspacePreviewUrl}
              filename={workspacePreviewFilename}
              variant={viewerVariant}
            />
          ) : null}
          {isWorkspacePresentation ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {operationStatusText || operationErrorText ? (
                <div className="mr-auto min-w-0 basis-full">
                  {operationStatusText && (
                    <p
                      id={operationStatusId}
                      aria-live="polite"
                      className="text-dashboard-metadata text-foreground/75"
                    >
                      {operationStatusText}
                    </p>
                  )}
                  {operationErrorText && (
                    <p
                      id={operationErrorId}
                      role="alert"
                      className="text-dashboard-metadata text-red-700"
                    >
                      {operationErrorText}
                    </p>
                  )}
                </div>
              ) : null}
              <button
                type="button"
                onClick={openPicker}
                disabled={disabled}
                className="min-h-11 flex-shrink-0 rounded-lg border border-border bg-white px-3 py-2 text-dashboard-action font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {replaceLabel}
              </button>
              {onRetry && operationErrorText && (
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={retryDisabled}
                  className="min-h-11 flex-shrink-0 rounded-lg border border-amber-200 bg-white px-3 py-2 text-dashboard-action font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {retryLabel}
                </button>
              )}
              <button
                type="button"
                onClick={removeFile}
                disabled={disabled}
                className="min-h-11 flex-shrink-0 rounded-lg px-3 py-2 text-dashboard-action font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex items-stretch gap-3 rounded-lg border border-border bg-surface p-3">
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
                  <FileImage
                    className="w-6 h-6 text-primary"
                    aria-hidden="true"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <FilenameText filename={file.name} />
                <p className="text-dashboard-metadata text-foreground/75">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                {operationStatusText && (
                  <p
                    id={operationStatusId}
                    aria-live="polite"
                    className="mt-1 text-dashboard-metadata text-foreground/75"
                  >
                    {operationStatusText}
                  </p>
                )}
                {operationErrorText && (
                  <p
                    id={operationErrorId}
                    role="alert"
                    className="mt-1 text-dashboard-metadata text-red-700"
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
                  className="min-h-11 flex-shrink-0 self-start rounded-lg border border-amber-200 bg-white px-3 py-2 text-dashboard-action font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {retryLabel}
                </button>
              )}
              <button
                type="button"
                onClick={removeFile}
                disabled={disabled}
                className="flex-shrink-0 self-start p-1 text-muted transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Remove file"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      ) : persistedFile ? (
        <div className={isWorkspacePresentation ? "space-y-3" : undefined}>
          {workspacePreviewUrl && workspacePreviewFilename ? (
            <WorkspaceImagePreview
              key={workspacePreviewUrl}
              src={workspacePreviewUrl}
              filename={workspacePreviewFilename}
              variant={viewerVariant}
            />
          ) : null}
          {isWorkspacePresentation ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {operationStatusText || operationErrorText ? (
                <div className="mr-auto min-w-0 basis-full">
                  {operationStatusText && (
                    <p
                      id={operationStatusId}
                      aria-live="polite"
                      className="text-dashboard-metadata text-foreground/75"
                    >
                      {operationStatusText}
                    </p>
                  )}
                  {operationErrorText && (
                    <p
                      id={operationErrorId}
                      role="alert"
                      className="text-dashboard-metadata text-red-700"
                    >
                      {operationErrorText}
                    </p>
                  )}
                </div>
              ) : null}
              <button
                type="button"
                onClick={openPicker}
                disabled={disabled}
                className="min-h-11 rounded-lg border border-border bg-white px-3 py-2 text-dashboard-action font-semibold text-foreground hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
              >
                {replaceLabel}
              </button>
              {onRetry && operationErrorText && (
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={retryDisabled}
                  className="min-h-11 rounded-lg border border-amber-200 bg-white px-3 py-2 text-dashboard-action font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {retryLabel}
                </button>
              )}
              {onRemovePersisted && (
                <button
                  type="button"
                  onClick={onRemovePersisted}
                  disabled={removeDisabled}
                  className="min-h-11 rounded-lg px-3 py-2 text-dashboard-action font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {removePersistedLabel}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-stretch">
              <PersistedFilePreview
                viewerVariant={viewerVariant}
                label={label}
                filename={persistedFile.filename}
                previewUrl={persistedFile.previewUrl ?? null}
              />
              <div className="min-w-0 flex-1">
                <FilenameText filename={persistedFile.filename} />
                <p className="text-dashboard-metadata text-foreground/75">
                  {formatFileSize(persistedFile.fileSize)}
                </p>
                <p className="mt-1 text-dashboard-metadata font-medium text-primary">
                  {persistedFile.statusLabel ?? "Saved in draft"}
                </p>
                {operationStatusText && (
                  <p
                    id={operationStatusId}
                    aria-live="polite"
                    className="mt-1 text-dashboard-metadata text-foreground/75"
                  >
                    {operationStatusText}
                  </p>
                )}
                {operationErrorText && (
                  <p
                    id={operationErrorId}
                    role="alert"
                    className="mt-1 text-dashboard-metadata text-red-700"
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
                  className="min-h-11 rounded-lg border border-border bg-white px-3 py-2 text-dashboard-action font-semibold text-foreground hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {replaceLabel}
                </button>
                {onRetry && operationErrorText && (
                  <button
                    type="button"
                    onClick={onRetry}
                    disabled={retryDisabled}
                    className="min-h-11 rounded-lg border border-amber-200 bg-white px-3 py-2 text-dashboard-action font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {retryLabel}
                  </button>
                )}
                {onRemovePersisted && (
                  <button
                    type="button"
                    onClick={onRemovePersisted}
                    disabled={removeDisabled}
                    className="min-h-11 rounded-lg border border-red-200 bg-white px-3 py-2 text-dashboard-action font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {removePersistedLabel}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          data-validation-control
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
              : validationError
                ? "border-red-300 bg-red-50/30 hover:border-red-400"
                : "border-border hover:border-primary/40 hover:bg-surface",
          )}
        >
          <Upload
            className="w-8 h-8 text-foreground/70 mx-auto mb-2"
            aria-hidden="true"
          />
          <span
            id={uploadActionId}
            className={cn(
              "block font-medium text-foreground",
              comfortable ? "text-base" : "text-sm",
            )}
          >
            {isDragActive ? "Drop file here" : "Click or drag to upload"}
          </span>
          <span
            id={maxSizeId}
            className={cn(
              "mt-1 block text-foreground/75",
              comfortable ? "text-sm" : "text-dashboard-metadata",
            )}
          >
            Max {Math.round(maxSize / 1024 / 1024)}MB
          </span>
        </button>
      )}

      {rejected && (
        <p
          id={rejectedId}
          role="alert"
          className={cn(
            "mt-1 text-red-700",
            comfortable ? "text-sm" : "text-dashboard-metadata",
          )}
        >
          File rejected. Please check format and size.
        </p>
      )}
      {isEmptyUploadState && operationStatusText && (
        <p
          id={operationStatusId}
          aria-live="polite"
          className={cn(
            "mt-1 text-foreground/75",
            comfortable ? "text-sm" : "text-dashboard-metadata",
          )}
        >
          {operationStatusText}
        </p>
      )}
      {isEmptyUploadState && operationErrorText && (
        <p
          id={operationErrorId}
          role="alert"
          className={cn(
            "mt-1 text-red-700",
            comfortable ? "text-sm" : "text-dashboard-metadata",
          )}
        >
          {operationErrorText}
        </p>
      )}
      {validationError && (
        <p
          id={validationErrorId}
          role="alert"
          className={cn(
            "mt-1.5 text-red-600",
            comfortable ? "text-sm" : "text-dashboard-metadata",
          )}
        >
          {validationError}
        </p>
      )}
    </div>
  );
}

function WorkspaceImagePreview({
  src,
  filename,
  variant,
}: {
  src: string;
  filename: string;
  variant: StaticImageViewerVariant;
}) {
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);

  return (
    <figure
      data-order-image-preview
      className="overflow-hidden rounded-xl border border-border bg-dashboard-canvas"
    >
      <div
        className={cn(
          "relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden",
          variant === "plan" ? "bg-white p-3" : "bg-dashboard-canvas",
        )}
      >
        {!loaded && !broken ? (
          <span className="absolute inset-0 animate-pulse bg-surface" />
        ) : null}
        {broken ? (
          <span className="flex flex-col items-center gap-2 px-4 text-center text-muted">
            <FileImage className="h-8 w-8 text-primary" aria-hidden="true" />
            <span className="text-dashboard-metadata font-semibold uppercase tracking-[0.08em]">
              Preview unavailable
            </span>
          </span>
        ) : (
          // Signed draft URLs and local blob URLs intentionally bypass
          // next/image. The fixed frame reserves space while object-contain
          // preserves the complete source composition.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`Original image preview: ${filename}`}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setBroken(true)}
            className="h-full w-full object-contain object-center"
          />
        )}
      </div>
    </figure>
  );
}

function PersistedFilePreview({
  viewerVariant,
  label,
  filename,
  previewUrl,
}: {
  viewerVariant: StaticImageViewerVariant;
  label: string;
  filename: string;
  previewUrl: string | null;
}) {
  return (
    <PersistedFilePreviewContent
      key={previewUrl ?? "empty"}
      viewerVariant={viewerVariant}
      label={label}
      filename={filename}
      previewUrl={previewUrl}
    />
  );
}

function PersistedFilePreviewContent({
  viewerVariant,
  label,
  filename,
  previewUrl,
}: {
  viewerVariant: StaticImageViewerVariant;
  label: string;
  filename: string;
  previewUrl: string | null;
}) {
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);
  const canOpen = previewUrl !== null && !broken;
  useViewerScrollLock(open);

  return (
    <div className="w-28 shrink-0 self-start sm:w-32">
      <button
        type="button"
        onClick={() => {
          if (canOpen) setOpen(true);
        }}
        disabled={!canOpen}
        className="relative block aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-white disabled:cursor-default"
        aria-label={`Open ${label} preview`}
      >
        {previewUrl && !broken ? (
          <>
            {!loaded && (
              <span className="absolute inset-0 animate-pulse bg-stone-100" />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={`${label}: ${filename}`}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              onError={() => setBroken(true)}
              className="h-full w-full object-cover"
            />
          </>
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-stone-100">
            <FileImage className="h-6 w-6 text-primary" aria-hidden="true" />
          </span>
        )}
      </button>
      {canOpen && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 text-dashboard-action font-semibold text-primary hover:text-primary-light"
        >
          Open preview
        </button>
      )}
      {open && previewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} preview`}
          className="static-image-viewer-overlay fixed inset-0 z-50 flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            data-static-image-viewer-panel={viewerVariant}
            className="static-image-viewer-panel grid h-full w-full max-w-4xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg bg-transparent sm:h-[min(92dvh,900px)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="static-image-viewer-panel-header flex min-w-0 items-center justify-between gap-3 pb-3">
              <p
                className="truncate text-sm font-semibold text-white"
                title={`${label}: ${filename}`}
              >
                {label}: {filename}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white shadow-sm transition hover:bg-white/20"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <NativeStaticImageStage
              variant={viewerVariant}
              src={previewUrl}
              alt={`${label}: ${filename}`}
              stageClassName="min-h-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function formatFileSize(size: number): string {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function FilenameText({ filename }: { filename: string }) {
  const { base, extension } = splitFilename(filename);

  return (
    <p
      title={filename}
      aria-label={filename}
      className="flex min-w-0 max-w-full text-sm font-medium text-foreground"
    >
      <span aria-hidden className="min-w-0 truncate">
        {base}
      </span>
      {extension && (
        <span aria-hidden className="shrink-0">
          {extension}
        </span>
      )}
      <span className="sr-only">{filename}</span>
    </p>
  );
}

function splitFilename(filename: string): {
  base: string;
  extension: string;
} {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === filename.length - 1) {
    return { base: filename, extension: "" };
  }
  return {
    base: filename.slice(0, lastDot),
    extension: filename.slice(lastDot),
  };
}
