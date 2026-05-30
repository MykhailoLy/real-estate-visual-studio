"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

// ============================================================
// ResetPasswordForm
//
// Rendered after the user clicks the password-reset link in
// their email. /auth/callback exchanges the recovery code for a
// session and redirects to /reset-password, so by the time this
// page renders the user is already authenticated with a recovery
// session — supabase.auth.updateUser() replaces their password.
// ============================================================

export default function ResetPasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [done,    setDone]    = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const form     = e.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirm  = (form.elements.namedItem("confirm")  as HTMLInputElement).value;

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const supabase = createBrowserSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setDone(true);
      // Give the user a moment to read the success message, then redirect
      setTimeout(() => {
        router.replace("/dashboard");
        router.refresh();
      }, 2000);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-4 space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground mb-1">Password updated</h2>
          <p className="text-sm text-muted">Taking you to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {/* New password */}
      <div>
        <label
          htmlFor="new-password"
          className="block text-[11px] font-bold uppercase tracking-[0.15em] text-muted mb-1.5"
        >
          New password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light pointer-events-none" aria-hidden />
          <input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={loading}
            placeholder="Min. 8 characters"
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-colors"
          />
        </div>
      </div>

      {/* Confirm new password */}
      <div>
        <label
          htmlFor="confirm-password"
          className="block text-[11px] font-bold uppercase tracking-[0.15em] text-muted mb-1.5"
        >
          Confirm new password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light pointer-events-none" aria-hidden />
          <input
            id="confirm-password"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            disabled={loading}
            placeholder="Repeat your new password"
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-colors"
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3.5 py-3 leading-relaxed"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-light transition-colors disabled:opacity-60 shadow-sm"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" aria-hidden />Updating password…</>
        ) : "Set new password"}
      </button>
    </form>
  );
}
