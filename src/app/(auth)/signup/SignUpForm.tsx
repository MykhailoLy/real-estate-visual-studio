"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2, Mail, Lock, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function SignUpForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const form    = e.currentTarget;
    const name    = (form.elements.namedItem("name")    as HTMLInputElement).value.trim();
    const email   = (form.elements.namedItem("email")   as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirm  = (form.elements.namedItem("confirm")  as HTMLInputElement).value;

    if (!name) { setError("Please enter your full name."); setLoading(false); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); setLoading(false); return; }
    if (password !== confirm) { setError("Passwords do not match."); setLoading(false); return; }

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) { setError(authError.message); return; }

      // Auto-confirm enabled → session written immediately, go to dashboard
      if (data?.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      // Email confirmation required (or unconfirmed user created) → show success state
      // Note: do NOT use identities.length === 0 to detect duplicates — with email
      // confirmation enabled Supabase returns an empty identities array even for a
      // freshly created unconfirmed user, which would incorrectly show an error.
      setSuccess(true);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-4 space-y-4">
        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground mb-1">Check your email</h2>
          <p className="text-sm text-muted leading-relaxed">
            We&rsquo;ve sent a confirmation link to your email address. Click it to activate
            your account — you&rsquo;ll be signed in automatically.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-light transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {/* Full name */}
      <div>
        <label htmlFor="signup-name" className="block text-[11px] font-bold uppercase tracking-[0.15em] text-muted mb-1.5">
          Full name
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light pointer-events-none" aria-hidden />
          <input id="signup-name" name="name" type="text" autoComplete="name" required disabled={loading}
            placeholder="Jane Smith"
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-colors"
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="signup-email" className="block text-[11px] font-bold uppercase tracking-[0.15em] text-muted mb-1.5">
          Email address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light pointer-events-none" aria-hidden />
          <input id="signup-email" name="email" type="email" autoComplete="email" required disabled={loading}
            placeholder="you@example.com"
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-colors"
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label htmlFor="signup-password" className="block text-[11px] font-bold uppercase tracking-[0.15em] text-muted mb-1.5">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light pointer-events-none" aria-hidden />
          <input id="signup-password" name="password" type="password" autoComplete="new-password"
            required minLength={8} disabled={loading} placeholder="Min. 8 characters"
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-colors"
          />
        </div>
      </div>

      {/* Confirm password */}
      <div>
        <label htmlFor="signup-confirm" className="block text-[11px] font-bold uppercase tracking-[0.15em] text-muted mb-1.5">
          Confirm password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light pointer-events-none" aria-hidden />
          <input id="signup-confirm" name="confirm" type="password" autoComplete="new-password"
            required disabled={loading} placeholder="Repeat your password"
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-colors"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3.5 py-3 leading-relaxed">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          {error}
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-light transition-colors disabled:opacity-60 shadow-sm mt-1"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" aria-hidden />Creating account…</>
        ) : "Create account"}
      </button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:text-primary-light transition-colors">
          Sign in
        </Link>
      </p>
    </form>
  );
}
