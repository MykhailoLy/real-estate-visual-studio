"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Upload, X, FileImage } from "lucide-react";
import { cn } from "@/lib/utils";

// Public API kept identical to the previous implementation so callers don't change.
export type FileUploadAccept = Record<string, string[]>;

interface FileUploadProps {
  label: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: FileUploadAccept;
  maxSize?: number;
  required?: boolean;
  helperText?: string;
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
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();
  const [isDragActive, setIsDragActive] = useState(false);
  const [rejected, setRejected] = useState(false);

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
    inputRef.current?.click();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragActive) setIsDragActive(true);
  };

  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    handleFiles(e.dataTransfer?.files ?? null);
  };

  const removeFile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRejected(false);
    onFileChange(null);
  };

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-foreground mb-1.5"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {helperText && <p className="text-xs text-muted mb-2">{helperText}</p>}

      {/* Hidden file input — always rendered so click + keyboard pickers work
          regardless of the visible state. */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={acceptString}
        className="sr-only"
        onChange={handleInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {file ? (
        <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
          <FileImage className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">
              {file.name}
            </p>
            <p className="text-xs text-muted">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <button
            type="button"
            onClick={removeFile}
            className="flex-shrink-0 p-1 text-muted hover:text-red-500 transition-colors"
            aria-label="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label={`${label}. Click or press Enter to choose a file, or drop a file here.`}
          onClick={openPicker}
          onKeyDown={onKeyDown}
          onDragOver={onDragOver}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all select-none",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-surface"
          )}
        >
          <Upload className="w-8 h-8 text-muted mx-auto mb-2" />
          <p className="text-sm text-foreground font-medium">
            {isDragActive ? "Drop file here" : "Click or drag to upload"}
          </p>
          <p className="text-xs text-muted mt-1">
            Max {Math.round(maxSize / 1024 / 1024)}MB
          </p>
        </div>
      )}

      {rejected && (
        <p className="text-xs text-red-500 mt-1">
          File rejected. Please check format and size.
        </p>
      )}
    </div>
  );
}
