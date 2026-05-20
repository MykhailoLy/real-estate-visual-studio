"use client";

import { useCallback } from "react";
import { useDropzone, type Accept } from "react-dropzone";
import { Upload, X, FileImage } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  label: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  accept?: Accept;
  maxSize?: number;
  required?: boolean;
  helperText?: string;
}

export default function FileUpload({
  label,
  file,
  onFileChange,
  accept = { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] },
  maxSize = 20 * 1024 * 1024,
  required = false,
  helperText,
}: FileUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileChange(acceptedFiles[0]);
      }
    },
    [onFileChange]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept,
      maxSize,
      multiple: false,
    });

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileChange(null);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {helperText && (
        <p className="text-xs text-muted mb-2">{helperText}</p>
      )}

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
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-surface"
          )}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 text-muted mx-auto mb-2" />
          <p className="text-sm text-foreground font-medium">
            {isDragActive ? "Drop file here" : "Click or drag to upload"}
          </p>
          <p className="text-xs text-muted mt-1">
            Max {maxSize / 1024 / 1024}MB
          </p>
        </div>
      )}

      {fileRejections.length > 0 && (
        <p className="text-xs text-red-500 mt-1">
          File rejected. Please check format and size.
        </p>
      )}
    </div>
  );
}
