"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { safeInternalPath } from "@/lib/safe-redirect";

export type LoginFormCopy = {
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  forgotPassword: string;
  submit: string;
  submitting: string;
  noAccount: string;
  createAccount: string;
  invalidCredentials: string;
  unexpectedError: string;
};

const DEFAULT_COPY: LoginFormCopy = {
  emailLabel: "Email address",
  emailPlaceholder: "you@example.com",
  passwordLabel: "Password",
  passwordPlaceholder: "Your password",
  forgotPassword: "Forgot password?",
  submit: "Sign in to your account",
  submitting: "Signing in...",
  noAccount: "Don't have an account?",
  createAccount: "Create one",
  invalidCredentials: "Incorrect email or password. Please try again.",
  unexpectedError: "An unexpected error occurred. Please try again.",
};

// ── helpers ──────────────────────────────────────────────────

/**
 * Append a redirectTo query param to an internal href, preserving any
 * existing query string. Used so navigating login → signup keeps the
 * intended post-auth destination.
 */
function withRedirect(href: string, redirectTo: string): string {
  if (redirectTo === "/dashboard") return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}redirectTo=${encodeURIComponent(redirectTo)}`;
}

// ── component ─────────────────────────────────────────────────

export default function LoginForm({
  copy = DEFAULT_COPY,
  signupHref = "/signup",
  forgotPasswordHref = "/forgot-password",
}: {
  copy?: LoginFormCopy;
  signupHref?: string;
  forgotPasswordHref?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeInternalPath(searchParams.get("redirectTo"));
  const signupHrefWithRedirect = withRedirect(signupHref, redirectTo);

  // Show inline error forwarded from /auth/callback (e.g. expired link)
  const callbackError = searchParams.get("error");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(callbackError ?? null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const email    = (form.elements.namedItem("email")    as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    try {
      const supabase = createBrowserSupabaseClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(
          authError.message === "Invalid login credentials"
            ? copy.invalidCredentials
            : authError.message
        );
        return;
      }

      // signInWithPassword writes the session cookie via @supabase/ssr,
      // so the proxy will see a valid session on the next request.
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError(copy.unexpectedError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {/* Email */}
      <div>
        <label
          htmlFor="login-email"
          className="block text-[11px] font-bold uppercase tracking-[0.15em] text-muted mb-1.5"
        >
          {copy.emailLabel}
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light pointer-events-none" aria-hidden />
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={loading}
            placeholder={copy.emailPlaceholder}
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-colors"
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="login-password"
            className="block text-[11px] font-bold uppercase tracking-[0.15em] text-muted"
          >
            {copy.passwordLabel}
          </label>
          <Link
            href={forgotPasswordHref}
            className="text-[12px] font-semibold text-primary hover:text-primary-light transition-colors"
          >
            {copy.forgotPassword}
          </Link>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light pointer-events-none" aria-hidden />
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={loading}
            placeholder={copy.passwordPlaceholder}
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-colors"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3.5 py-3 leading-relaxed"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-light transition-colors disabled:opacity-60 shadow-sm"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" aria-hidden />{copy.submitting}</>
        ) : (
          copy.submit
        )}
      </button>

      <p className="text-center text-sm text-muted">
        {copy.noAccount}{" "}
        <Link href={signupHrefWithRedirect} className="font-semibold text-primary hover:text-primary-light transition-colors">
          {copy.createAccount}
        </Link>
      </p>
    </form>
  );
}
