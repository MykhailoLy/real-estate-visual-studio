"use client";

import { useRef, useState, type FormEvent } from "react";

export default function AdminPartnerInviteForm() {
  const submitting = useRef(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    submitting.current = true;
    setLoading(true);
    setMessage("");
    setFailed(false);
    try {
      const response = await fetch("/api/admin/clients/invite-partner", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) {
        setFailed(true);
        setMessage(typeof result.error === "string" ? result.error : "Invitation could not be confirmed. Check Admin Clients before retrying.");
        return;
      }
      setMessage("Invitation sent. 10% Partner Pricing is enabled for eligible digital services.");
      form.reset();
    } catch {
      setFailed(true);
      setMessage("Invitation could not be confirmed. Reload Admin Clients before retrying; an invitation or account may already exist.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="partner-invite-title" className="rounded-xl border border-border bg-white p-4 sm:p-5">
      <h2 id="partner-invite-title" className="font-semibold text-primary">Invite Partner client</h2>
      <p id="partner-invite-help" className="mt-1 text-sm text-muted">
        Send an account invitation and assign 10% Partner Pricing before the client’s first order.
      </p>
      <form onSubmit={onSubmit} aria-busy={loading} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <label htmlFor="partner-invite-email" className="mb-1.5 block text-sm font-semibold text-foreground">Email address</label>
          <input id="partner-invite-email" name="email" type="email" required autoComplete="email" disabled={loading}
            aria-describedby="partner-invite-help"
            className="min-h-11 w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60" />
        </div>
        <button type="submit" disabled={loading}
          className="min-h-11 shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60">
          {loading ? "Sending invite…" : "Send invite"}
        </button>
      </form>
      <p role={failed ? "alert" : "status"} className="mt-3 min-h-5 text-sm text-foreground">{message}</p>
      {/* [locale] overmatches this href in Next lint; a full reload must refresh the invite result. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      {message && <a href="/admin/clients" className="mt-2 inline-block text-sm font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Reload Admin Clients</a>}
    </section>
  );
}
