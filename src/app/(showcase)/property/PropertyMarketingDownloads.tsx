"use client";

import {
  Download,
  FileImage,
  FileText,
  Loader2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PropertyMarketingMaterialLinks } from "@/features/property-showcase/marketing-materials";
import type { PropertyLanguageCode } from "@/features/property-showcase/types";

interface PropertyMarketingDownloadsProps {
  links: PropertyMarketingMaterialLinks;
  language: PropertyLanguageCode;
}

type ActionId = "pdf" | "jpg" | "png";
type ActionState = "idle" | "preparing" | "ready" | "error";

const COPY = {
  en: {
    button: "Download brochure",
    title: "Property brochure",
    description: "Preview the finished brochure, then download your preferred format.",
    close: "Close",
    preview: "Finished property brochure preview",
    preparingPreview: "Preparing brochure preview…",
    previewError: "The brochure preview could not be loaded.",
    preparing: "Preparing",
    ready: "Ready",
    retry: "Please retry.",
  },
  es: {
    button: "Descargar folleto",
    title: "Folleto de la propiedad",
    description: "Previsualiza el folleto terminado y elige el formato de descarga.",
    close: "Cerrar",
    preview: "Vista previa del folleto terminado",
    preparingPreview: "Preparando vista previa…",
    previewError: "No se pudo cargar la vista previa.",
    preparing: "Preparando",
    ready: "Listo",
    retry: "Inténtalo de nuevo.",
  },
} as const;

export default function PropertyMarketingDownloads({
  links,
  language,
}: PropertyMarketingDownloadsProps) {
  const [open, setOpen] = useState(false);
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "error">("loading");
  const [activeAction, setActiveAction] = useState<ActionId | null>(null);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const copy = language === "es" ? COPY.es : COPY.en;

  function closeDialog() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href]:not([aria-disabled="true"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable.at(-1) ?? first;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!links.preview || (!links.pdf && !links.jpg && !links.png)) {
    return null;
  }

  const actions: Array<{
    id: ActionId;
    label: string;
    detail: string;
    icon: LucideIcon;
    href: string;
  }> = [
    links.pdf ? { id: "pdf", label: "Download PDF", detail: "Print-ready document", icon: FileText, href: links.pdf } : null,
    links.jpg ? { id: "jpg", label: "Download JPG", detail: "High-resolution image", icon: FileImage, href: links.jpg } : null,
    links.png ? { id: "png", label: "Download PNG", detail: "Lossless high-resolution image", icon: FileImage, href: links.png } : null,
  ].filter((action): action is { id: ActionId; label: string; detail: string; icon: LucideIcon; href: string } => Boolean(action));

  async function runAction(id: ActionId) {
    if (actionState === "preparing") return;
    const action = actions.find((candidate) => candidate.id === id);
    if (!action) return;
    setActiveAction(id);
    setActionState("preparing");
    setActionError(null);
    try {
      const anchor = document.createElement("a");
      const url = new URL(action.href, window.location.origin);
      url.searchParams.set("download", `property-flyer.${id}`);
      anchor.href = url.toString();
      anchor.download = `property-flyer.${id}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setActionState("ready");
    } catch (error) {
      setActionState("error");
      setActionError(
        error instanceof Error ? error.message : "Could not prepare the brochure.",
      );
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setPreviewState("loading");
          setActionState("idle");
          setActionError(null);
          setOpen(true);
        }}
        data-testid="hero-download-brochure"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/45 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
      >
        <Download className="h-4 w-4" aria-hidden />
        {copy.button}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-[#071426]/70 p-2 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="property-materials-title"
            aria-describedby="property-materials-description"
            data-testid="property-marketing-download-dialog"
            className="max-h-[calc(100dvh-1rem)] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-4 text-[#0B1F3A] shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="property-materials-title" className="text-xl font-bold sm:text-2xl">
                  {copy.title}
                </h2>
                <p id="property-materials-description" className="mt-1 text-sm leading-6 text-slate-600">
                  {copy.description}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={closeDialog}
                aria-label={copy.close}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div
                className="relative mx-auto flex min-h-64 w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 lg:min-h-96"
                aria-label={copy.preview}
              >
                {links.previewKind === "document" ? (
                  <div className="flex flex-col items-center gap-3 px-6 text-center text-[#0B1F3A]">
                    <FileText className="h-12 w-12 text-[#B88A44]" aria-hidden />
                    <span className="text-sm font-bold">PDF brochure ready to download</span>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={links.preview}
                    alt={copy.preview}
                    onLoad={() => setPreviewState("ready")}
                    onError={() => setPreviewState("error")}
                    className={`h-full w-full object-contain transition-opacity ${previewState === "ready" ? "opacity-100" : "opacity-0"}`}
                  />
                )}
                {links.previewKind !== "document" && previewState !== "ready" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-[#0B1F3A]" role="status">
                    {previewState === "loading" ? <Loader2 className="h-7 w-7 animate-spin" aria-hidden /> : <FileImage className="h-7 w-7" aria-hidden />}
                    <span className="text-sm font-bold">{previewState === "loading" ? copy.preparingPreview : copy.previewError}</span>
                  </div>
                ) : null}
              </div>

              <aside className="min-w-0 rounded-xl border border-slate-200 p-3 sm:p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Property flyer
                </p>
                <div className="mt-3 grid gap-2">
                  {actions.map(({ id, label, detail, icon: Icon }) => {
                    const preparing = activeAction === id && actionState === "preparing";
                    const ready = activeAction === id && actionState === "ready";
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => runAction(id)}
                        disabled={actionState === "preparing"}
                        className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left transition hover:border-[#0B1F3A]/40 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A] disabled:cursor-wait disabled:opacity-60"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0B1F3A] text-white">
                          {preparing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold">{preparing ? `${copy.preparing} ${id.toUpperCase()}…` : label}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">{ready ? copy.ready : detail}</span>
                        </span>
                        <Download className="h-4 w-4 shrink-0" aria-hidden />
                      </button>
                    );
                  })}
                </div>
                <div aria-live="polite" className="mt-3 min-h-5 text-xs text-slate-600">
                  {actionState === "preparing" && activeAction ? `${copy.preparing} ${activeAction.toUpperCase()}…` : null}
                  {actionState === "ready" ? copy.ready : null}
                  {actionState === "error" ? `${actionError} ${copy.retry}` : null}
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
