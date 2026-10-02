"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

/** Shared confirmation interaction; self and admin use distinct server routes. */
export default function DeleteAccountControl({ email, userId, pending = false }: {
  email: string; userId?: string; pending?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || confirmation !== email) return;
    setBusy(true); setError("");
    try {
      const endpoint = userId ? `/api/admin/clients/${encodeURIComponent(userId)}/delete` : "/api/account/delete";
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationEmail: confirmation }),
      });
      const result = await response.json();
      if (response.status !== 202 || result.status !== "pending") {
        throw new Error(result.error || "Deletion could not be confirmed. Please retry.");
      }
      if (!userId) {
        try { await createBrowserSupabaseClient().auth.signOut({ scope: "local" }); }
        finally { window.location.replace("/account-deletion-requested"); }
        return;
      }
      dialog.current?.close();
      setAccepted(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Deletion could not be confirmed. Please retry.");
    } finally { setBusy(false); }
  }

  return <div className={userId ? "mt-3" : "mt-8 rounded-xl border border-red-200 bg-white p-5 sm:p-6"}>
    {!userId && <>
      <h2 className="text-lg font-bold text-primary">Danger Zone</h2>
      <h3 className="mt-3 font-semibold text-foreground">Delete account</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">Account access ends immediately. Your profile and temporary drafts will be removed after uploads expire. Submitted orders, payments and commercial records are retained. This cannot be undone.</p>
    </>}
    {pending || accepted ? <p role="status" className="text-sm text-muted">Deletion pending. Account access is blocked; final cleanup runs after uploads expire.</p> : <button
      ref={trigger} type="button" className="mt-3 min-h-11 rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
      onClick={() => { setConfirmation(""); setError(""); dialog.current?.showModal(); input.current?.focus(); }}
    >Delete account</button>}
    <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-border bg-white p-5 text-foreground shadow-xl backdrop:bg-black/50 sm:p-6"
      onCancel={(event) => { if (busy) event.preventDefault(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input:not(:disabled), button:not(:disabled)");
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onClose={() => trigger.current?.focus()}>
      <form onSubmit={submit}>
        <h2 id={`${id}-title`} className="text-xl font-bold text-primary">Permanently delete account?</h2>
        <p id={`${id}-description`} className="mt-3 text-sm leading-relaxed text-muted">Access ends immediately. Profile and temporary drafts are removed after outstanding upload links expire. Submitted orders and payment records remain. You cannot recover this account or its order access by registering again.</p>
        <label htmlFor={`${id}-email`} className="mt-5 block text-sm font-semibold">Type <span className="break-all">{email}</span> exactly to confirm</label>
        <input ref={input} id={`${id}-email`} type="text" autoComplete="off" spellCheck={false}
          value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy}
          className="mt-2 min-h-11 w-full rounded-lg border border-border-strong px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => dialog.current?.close()} className="min-h-11 rounded-lg border border-border-strong px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2">Cancel</button>
          <button type="submit" disabled={busy || confirmation !== email} className="min-h-11 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">{busy ? "Requesting deletion…" : "Permanently delete account"}</button>
        </div>
      </form>
    </dialog>
  </div>;
}
