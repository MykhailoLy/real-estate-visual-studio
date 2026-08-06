"use client";

import { Download, FileImage, FileText, X, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PropertyMarketingMaterialLinks } from "@/features/property-showcase/marketing-materials";
import type { PropertyLanguageCode } from "@/features/property-showcase/types";

interface PropertyMarketingDownloadsProps {
  links: PropertyMarketingMaterialLinks;
  language: PropertyLanguageCode;
}

const COPY = {
  en: {
    button: "Download brochure",
    title: "Property marketing materials",
    description: "Choose a print-ready flyer or a landscape image.",
    close: "Close",
    printReady: "Print ready",
    highResolution: "High resolution",
  },
  es: {
    button: "Descargar folleto",
    title: "Materiales de la propiedad",
    description: "Elige un folleto para imprimir o una imagen horizontal.",
    close: "Cerrar",
    printReady: "Listo para imprimir",
    highResolution: "Alta resolución",
  },
} as const;

export default function PropertyMarketingDownloads({
  links,
  language,
}: PropertyMarketingDownloadsProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const copy = language === "es" ? COPY.es : COPY.en;
  const options = useMemo(() => {
    const items: Array<{
      href: string;
      label: string;
      detail: string;
      icon: LucideIcon;
    }> = [];
    if (links.flyerPdf) items.push({ href: links.flyerPdf, label: "A4 PDF", detail: copy.printReady, icon: FileText });
    if (links.flyerJpg) items.push({ href: links.flyerJpg, label: "A4 JPG", detail: copy.highResolution, icon: FileImage });
    if (links.flyerPng) items.push({ href: links.flyerPng, label: "A4 PNG", detail: copy.highResolution, icon: FileImage });
    if (links.landscapeJpg) items.push({ href: links.landscapeJpg, label: "Landscape JPG", detail: copy.highResolution, icon: FileImage });
    if (links.landscapePng) items.push({ href: links.landscapePng, label: "Landscape PNG", detail: copy.highResolution, icon: FileImage });
    return items;
  }, [copy.highResolution, copy.printReady, links]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
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

  if (options.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="hero-download-brochure"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/45 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
      >
        <Download className="h-4 w-4" aria-hidden />
        {copy.button}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-[#071426]/70 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="property-materials-title"
            aria-describedby="property-materials-description"
            data-testid="property-marketing-download-dialog"
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 text-[#0B1F3A] shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="property-materials-title" className="text-xl font-bold sm:text-2xl">
                  {copy.title}
                </h2>
                <p id="property-materials-description" className="mt-2 text-sm leading-6 text-slate-600">
                  {copy.description}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label={copy.close}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="mt-6 grid gap-2">
              {options.map(({ href, label, detail, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  download
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 transition hover:border-[#0B1F3A]/40 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0B1F3A] text-white">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-bold">{label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{detail}</span>
                  </span>
                  <Download className="ml-auto h-4 w-4 shrink-0" aria-hidden />
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
