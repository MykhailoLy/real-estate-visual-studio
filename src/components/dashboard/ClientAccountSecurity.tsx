"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield } from "lucide-react";
import ClientPortalLink from "@/components/dashboard/ClientPortalLink";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function ClientAccountSecurity({ authEmail, authUserId }: { authEmail: string; authUserId: string }) {
  const router = useRouter();
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDone, setPasswordDone] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "USER_UPDATED" || event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        // The server verifies Auth again; a pending address is never promoted
        // just because it was entered into the form or stored in a local JWT.
        router.refresh();
      }
    });
    let active = true;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (active && user?.id === authUserId && user.new_email) setPendingEmail(user.new_email);
    }).catch(() => { /* Submission still performs its own verified Auth check. */ });
    return () => { active = false; subscription.unsubscribe(); };
  }, [authUserId, router]);

  const busy = emailLoading || passwordLoading;
  const inputClass = "w-full rounded-lg border border-border bg-white px-3 py-2.5 text-dashboard-mobile-control text-foreground placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 md:text-sm";
  const labelClass = "mb-1.5 block text-dashboard-action font-bold uppercase tracking-[0.06em] text-muted-light";
  const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-dashboard-action font-bold text-white transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60";

  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    setEmailError(null);
    if (email.toLowerCase() === authEmail.toLowerCase()) {
      setEmailError("Enter a different email address.");
      return;
    }
    setEmailLoading(true);
    try {
      const response = await fetch("/api/account/prepare-email-change", { method: "POST" });
      const prepared = await response.json();
      if (!response.ok || prepared.prepared !== true) {
        setEmailError(prepared.error ?? "We could not confirm your order ownership. Please try again.");
        return;
      }
      const supabase = createBrowserSupabaseClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user || user.id !== authUserId || user.id !== prepared.userId || user.email !== prepared.email) {
        setEmailError("Your session changed. Reload this page before trying again.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ email }, {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard/profile`,
      });
      if (error) { setEmailError(error.message); return; }
      setPendingEmail(email);
      setEditingEmail(false);
      form.reset();
      router.refresh();
    } catch {
      setEmailError("Unable to request an email change. Please try again.");
    } finally {
      setEmailLoading(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const currentPassword = (form.elements.namedItem("currentPassword") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirm") as HTMLInputElement).value;
    setPasswordError(null);
    setPasswordDone(false);
    if (!currentPassword) { setPasswordError("Enter your current password."); return; }
    if (password.length < 8) { setPasswordError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setPasswordError("Passwords do not match."); return; }
    setPasswordLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user || user.id !== authUserId) {
        setPasswordError("Your session changed. Reload this page before trying again.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password, current_password: currentPassword });
      if (error) { setPasswordError(error.message); return; }
      form.reset();
      setPasswordDone(true);
    } catch {
      setPasswordError("Unable to change your password. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <section aria-labelledby="account-security-heading" className="mt-8 overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-surface/60 px-5 py-3.5">
        <Shield className="h-4 w-4 text-primary" aria-hidden />
        <h2 id="account-security-heading" className="text-dashboard-section font-bold text-foreground lg:text-lg">Account &amp; Security</h2>
      </div>
      <div className="space-y-6 px-5 py-5">
        <div>
          <h3 className="font-bold text-foreground">Email address</h3>
          <p className="mt-1 break-all text-dashboard-body text-muted">{authEmail}</p>
          {pendingEmail && pendingEmail.toLowerCase() !== authEmail.toLowerCase() && (
            <p role="status" className="mt-3 rounded-lg border border-primary/15 bg-primary/5 p-3 text-dashboard-body text-foreground">
              Check your email to confirm the change. Your current email remains active until confirmation.
            </p>
          )}
          {!editingEmail ? (
            <button type="button" disabled={busy} onClick={() => { setEmailError(null); setEditingEmail(true); }} className={`${buttonClass} mt-3`}>Change email</button>
          ) : (
            <form onSubmit={changeEmail} className="mt-3 space-y-3" aria-label="Change email">
              <div>
                <label htmlFor="account-new-email" className={labelClass}>New email address</label>
                <input id="account-new-email" name="email" type="email" autoComplete="email" required disabled={busy} className={inputClass} />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="submit" disabled={busy} className={buttonClass}>
                  {emailLoading ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Sending confirmation…</> : "Send confirmation"}
                </button>
                <button type="button" disabled={busy} onClick={() => setEditingEmail(false)} className="min-h-11 rounded-lg px-4 text-dashboard-action font-bold text-primary focus-visible:outline-2 focus-visible:outline-primary">Cancel</button>
              </div>
            </form>
          )}
          {emailError && <p role="alert" className="mt-3 text-dashboard-body text-red-700">{emailError}</p>}
        </div>
        <form onSubmit={changePassword} noValidate aria-label="Change password" className="space-y-4 border-t border-border pt-6">
          <h3 className="font-bold text-foreground">Change password</h3>
          <div>
            <label htmlFor="account-current-password" className={labelClass}>Current password</label>
            <input id="account-current-password" name="currentPassword" type="password" autoComplete="current-password" required disabled={busy} className={inputClass} />
          </div>
          <ClientPortalLink href="/forgot-password" className="inline-flex min-h-11 items-center rounded text-dashboard-action font-bold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">Forgot current password?</ClientPortalLink>
          <div>
            <label htmlFor="account-new-password" className={labelClass}>New password</label>
            <input id="account-new-password" name="password" type="password" autoComplete="new-password" required minLength={8} disabled={busy} aria-describedby="account-password-hint" className={inputClass} />
            <p id="account-password-hint" className="mt-1 text-dashboard-metadata text-muted-light">At least 8 characters.</p>
          </div>
          <div>
            <label htmlFor="account-confirm-password" className={labelClass}>Confirm new password</label>
            <input id="account-confirm-password" name="confirm" type="password" autoComplete="new-password" required disabled={busy} className={inputClass} />
          </div>
          {passwordError && <p role="alert" className="text-dashboard-body text-red-700">{passwordError}</p>}
          {passwordDone && <p role="status" className="text-dashboard-body text-emerald-700">Password updated successfully.</p>}
          <button type="submit" disabled={busy} className={`${buttonClass} w-full sm:w-auto`}>
            {passwordLoading ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Updating password…</> : "Update password"}
          </button>
        </form>
      </div>
    </section>
  );
}
