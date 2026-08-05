"use client";

import { CalendarDays, CheckCircle2, ExternalLink, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import type { PropertyLanguageCode } from "@/features/property-showcase/types";

type DialogCopy = {
  title: string;
  intro: string;
  fullName: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  message: string;
  submit: string;
  sending: string;
  success: string;
  successDetail: string;
  delayed: string;
  whatsapp: string;
  close: string;
  preview: string;
  error: string;
};

const EN_COPY: DialogCopy = {
  title: "Request a viewing",
  intro: "Tell the property team how to reach you and when you would like to visit.",
  fullName: "Full name",
  email: "Email",
  phone: "Phone (optional)",
  date: "Preferred viewing date (optional)",
  time: "Preferred time (optional)",
  message: "Message (optional)",
  submit: "Send viewing request",
  sending: "Sending request",
  success: "Your viewing request is saved",
  successDetail: "The property team has received your enquiry details.",
  delayed: "Your request is saved, but email delivery was not confirmed. The team may take a little longer to respond.",
  whatsapp: "Continue in WhatsApp",
  close: "Close",
  preview: "Submissions are disabled in the admin preview.",
  error: "We could not save your request. Please check the form and try again.",
};

const ES_COPY: DialogCopy = {
  title: "Solicitar visita",
  intro: "Indique al equipo cómo contactar con usted y cuándo desea visitar la propiedad.",
  fullName: "Nombre completo",
  email: "Correo electrónico",
  phone: "Teléfono (opcional)",
  date: "Fecha preferida (opcional)",
  time: "Hora preferida (opcional)",
  message: "Mensaje (opcional)",
  submit: "Enviar solicitud",
  sending: "Enviando solicitud",
  success: "Su solicitud de visita se ha guardado",
  successDetail: "El equipo de la propiedad ha recibido los datos de su consulta.",
  delayed: "Su solicitud está guardada, pero no se ha confirmado la entrega del correo. La respuesta puede tardar un poco más.",
  whatsapp: "Continuar en WhatsApp",
  close: "Cerrar",
  preview: "Los envíos están desactivados en la vista previa de administración.",
  error: "No se pudo guardar la solicitud. Revise el formulario e inténtelo de nuevo.",
};

type SubmissionState =
  | { status: "idle" | "submitting" }
  | {
      status: "success";
      notificationUnconfirmed: boolean;
      whatsappUrl?: string;
    }
  | { status: "error"; message: string };

export default function PropertyViewingRequestDialog({
  open,
  onOpenChange,
  propertySlug,
  propertyTitle,
  locale,
  turnstileSiteKey,
  submissionEnabled = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertySlug: string;
  propertyTitle: string;
  locale: PropertyLanguageCode;
  turnstileSiteKey?: string | null;
  submissionEnabled?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [submission, setSubmission] = useState<SubmissionState>({ status: "idle" });
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const copy = locale === "es" ? ES_COPY : EN_COPY;
  const turnstileEnabled = Boolean(turnstileSiteKey?.trim());

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function closeDialog() {
    onOpenChange(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submissionEnabled || submission.status === "submitting") return;
    if (turnstileEnabled && !turnstileToken) {
      setSubmission({ status: "error", message: "Please complete the security check." });
      return;
    }

    setSubmission({ status: "submitting" });
    const data = new FormData(event.currentTarget);
    const payload = {
      propertySlug,
      locale,
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      phone: String(data.get("phone") ?? ""),
      preferredDate: String(data.get("preferredDate") ?? ""),
      preferredTime: String(data.get("preferredTime") ?? ""),
      message: String(data.get("message") ?? ""),
      website: String(data.get("website") ?? ""),
      turnstileToken: turnstileToken ?? "",
    };

    try {
      const response = await fetch("/api/property-leads", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        error?: string;
        notificationStatus?: "sent" | "failed" | "skipped";
        whatsappUrl?: string;
      };
      if (!response.ok && response.status !== 202) {
        setSubmission({ status: "error", message: body.error ?? copy.error });
        setTurnstileToken(null);
        setTurnstileResetSignal((value) => value + 1);
        return;
      }

      formRef.current?.reset();
      setSubmission({
        status: "success",
        notificationUnconfirmed: body.notificationStatus !== "sent",
        whatsappUrl: body.whatsappUrl,
      });
    } catch {
      setSubmission({ status: "error", message: copy.error });
      setTurnstileToken(null);
      setTurnstileResetSignal((value) => value + 1);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="viewing-request-title"
      onClose={() => onOpenChange(false)}
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      className="m-auto max-h-[min(92svh,780px)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg border border-white/10 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-[#071426]/75"
      data-testid="property-viewing-dialog"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-black/8 bg-white px-5 py-4 sm:px-7">
        <div className="min-w-0">
          <h2 id="viewing-request-title" className="text-xl font-semibold text-[#0f2440] sm:text-2xl">
            {copy.title}
          </h2>
          <p className="mt-1 break-words text-sm font-medium text-slate-500">
            {propertyTitle}
          </p>
        </div>
        <button
          type="button"
          onClick={closeDialog}
          aria-label={copy.close}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/10 text-[#0f2440] transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f2440]"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {submission.status === "success" ? (
        <div className="px-5 py-10 text-center sm:px-8 sm:py-14" role="status">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
          <h3 className="mt-5 text-2xl font-semibold text-[#0f2440]">{copy.success}</h3>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">
            {submission.notificationUnconfirmed ? copy.delayed : copy.successDetail}
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            {submission.whatsappUrl ? (
              <a
                href={submission.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0f2440] px-5 py-3 text-sm font-bold text-white"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                {copy.whatsapp}
              </a>
            ) : null}
            <button
              type="button"
              onClick={closeDialog}
              className="min-h-12 rounded-full border border-[#0f2440]/20 px-5 py-3 text-sm font-bold text-[#0f2440]"
            >
              {copy.close}
            </button>
          </div>
        </div>
      ) : (
        <form ref={formRef} onSubmit={submit} className="px-5 py-6 sm:px-7 sm:py-7">
          <p className="text-sm leading-6 text-slate-600">{copy.intro}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-[#0f2440]">
              {copy.fullName}
              <input name="name" required minLength={2} maxLength={100} autoComplete="name" className="mt-1.5 min-h-11 w-full rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-[#0f2440] focus:ring-2 focus:ring-[#0f2440]/15" />
            </label>
            <label className="text-sm font-bold text-[#0f2440]">
              {copy.email}
              <input name="email" required type="email" maxLength={320} autoComplete="email" className="mt-1.5 min-h-11 w-full rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-[#0f2440] focus:ring-2 focus:ring-[#0f2440]/15" />
            </label>
            <label className="text-sm font-bold text-[#0f2440]">
              {copy.phone}
              <input name="phone" type="tel" maxLength={40} autoComplete="tel" className="mt-1.5 min-h-11 w-full rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-[#0f2440] focus:ring-2 focus:ring-[#0f2440]/15" />
            </label>
            <label className="text-sm font-bold text-[#0f2440]">
              {copy.date}
              <input name="preferredDate" type="date" className="mt-1.5 min-h-11 w-full rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-[#0f2440] focus:ring-2 focus:ring-[#0f2440]/15" />
            </label>
            <label className="text-sm font-bold text-[#0f2440] sm:col-span-1">
              {copy.time}
              <input name="preferredTime" type="time" className="mt-1.5 min-h-11 w-full rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-[#0f2440] focus:ring-2 focus:ring-[#0f2440]/15" />
            </label>
            <label className="text-sm font-bold text-[#0f2440] sm:col-span-2">
              {copy.message}
              <textarea name="message" rows={4} maxLength={2000} className="mt-1.5 w-full rounded-md border border-black/15 px-3 py-2 font-normal outline-none focus:border-[#0f2440] focus:ring-2 focus:ring-[#0f2440]/15" />
            </label>
            <label className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <TurnstileWidget
            siteKey={turnstileSiteKey}
            action="property_lead"
            resetSignal={turnstileResetSignal}
            onTokenChange={setTurnstileToken}
          />

          {submission.status === "error" ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {submission.message}
            </p>
          ) : null}
          {!submissionEnabled ? (
            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {copy.preview}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-black/8 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeDialog}
              className="min-h-12 rounded-full border border-[#0f2440]/20 px-5 py-3 text-sm font-bold text-[#0f2440]"
            >
              {copy.close}
            </button>
            <button
              type="submit"
              disabled={
                !submissionEnabled ||
                submission.status === "submitting" ||
                (turnstileEnabled && !turnstileToken)
              }
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0f2440] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1a365d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submission.status === "submitting" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CalendarDays className="h-4 w-4" aria-hidden />
              )}
              {submission.status === "submitting" ? copy.sending : copy.submit}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
