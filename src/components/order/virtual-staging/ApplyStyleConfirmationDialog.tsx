"use client";

import { useEffect, useId, useRef } from "react";

interface ApplyStyleConfirmationDialogProps {
  open: boolean;
  overrideCount: number;
  onCancel: () => void;
  onConfirm: () => void;
  disabled?: boolean;
}

export default function ApplyStyleConfirmationDialog({
  open,
  overrideCount,
  onCancel,
  onConfirm,
  disabled = false,
}: ApplyStyleConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      if (!dialog.open) dialog.showModal();
      const frame = requestAnimationFrame(() => cancelButtonRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
    if (dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClose={() => {
        if (open) onCancel();
        returnFocusRef.current?.focus?.();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-white p-0 text-foreground shadow-2xl backdrop:bg-[#071426]/70"
    >
      <div className="p-5 sm:p-6">
        <h2 id={titleId} className="text-lg font-bold text-primary">
          Apply this style to all images?
        </h2>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-muted">
          This will replace individual style selections for {overrideCount}{" "}
          {overrideCount === 1 ? "image" : "images"}.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={disabled}
            className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
          >
            Apply to All
          </button>
        </div>
      </div>
    </dialog>
  );
}
