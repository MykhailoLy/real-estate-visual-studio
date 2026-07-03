"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import {
  DEFAULT_TURNSTILE_COPY,
  normalizeTurnstileSiteKey,
  type TurnstileCopy,
} from "@/components/auth/turnstile";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { safeInternalPath } from "@/lib/safe-redirect";

export type SignUpFormCopy = {
  fullNameLabel: string;
  fullNamePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  confirmPasswordLabel: string;
  confirmPasswordPlaceholder: string;
  submit: string;
  submitting: string;
  alreadyHaveAccount: string;
  signIn: string;
  successTitle: string;
  successMessage: string;
  backToSignIn: string;
  missingName: string;
  shortPassword: string;
  passwordMismatch: string;
  unexpectedError: string;
  turnstile: TurnstileCopy;
};

const DEFAULT_COPY: SignUpFormCopy = {
  fullNameLabel: "Full name",
  fullNamePlaceholder: "Jane Smith",
  emailLabel: "Email address",
  emailPlaceholder: "you@example.com",
  passwordLabel: "Password",
  passwordPlaceholder: "Min. 8 characters",
  confirmPasswordLabel: "Confirm password",
  confirmPasswordPlaceholder: "Repeat your password",
  submit: "Create account",
  submitting: "Creating account...",
  alreadyHaveAccount: "Already have an account?",
  signIn: "Sign in",
  successTitle: "Check your email",
  successMessage:
    "We've sent a confirmation link to your email address. Click it to activate your account - you'll be signed in automatically.",
  backToSignIn: "Back to sign in",
  missingName: "Please enter your full name.",
  shortPassword: "Password must be at least 8 characters.",
  passwordMismatch: "Passwords do not match.",
  unexpectedError: "An unexpected error occurred. Please try again.",
  turnstile: DEFAULT_TURNSTILE_COPY,
};

export default function SignUpForm({
  copy = DEFAULT_COPY,
  loginHref = "/login",
  turnstileSiteKey,
}: {
  copy?: SignUpFormCopy;
  loginHref?: string;
  turnstileSiteKey?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeInternalPath(searchParams.get("redirectTo"));
  const normalizedTurnstileSiteKey = normalizeTurnstileSiteKey(turnstileSiteKey);
  const turnstileEnabled = Boolean(normalizedTurnstileSiteKey);
  const hasRedirect = redirectTo !== "/dashboard";
  const loginHrefWithRedirect = hasRedirect
    ? `${loginHref}${loginHref.includes("?") ? "&" : "?"}redirectTo=${encodeURIComponent(redirectTo)}`
    : loginHref;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);

  const onTurnstileTokenChange = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken(null);
    setTurnstileResetSignal((value) => value + 1);
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirm") as HTMLInputElement).value;

    if (!name) {
      setError(copy.missingName);
      return;
    }
    if (password.length < 8) {
      setError(copy.shortPassword);
      return;
    }
    if (password !== confirm) {
      setError(copy.passwordMismatch);
      return;
    }

    const captchaToken = turnstileEnabled ? turnstileToken : null;
    if (turnstileEnabled && !captchaToken) {
      setError(copy.turnstile.required);
      return;
    }

    setLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      // Preserve the intended order destination across email confirmation
      // by passing it as ?next= on the callback URL. The callback
      // sanitizes it again server-side.
      const callbackUrl = new URL(`${window.location.origin}/auth/callback`);
      if (hasRedirect) callbackUrl.searchParams.set("next", redirectTo);

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: callbackUrl.toString(),
          ...(captchaToken ? { captchaToken } : {}),
        },
      });

      if (authError) {
        setError(authError.message);
        if (turnstileEnabled) resetTurnstile();
        return;
      }

      if (data?.session) {
        // Rare: email confirmation disabled → immediate session.
        router.replace(redirectTo);
        router.refresh();
        return;
      }

      setSuccess(true);
    } catch {
      setError(copy.unexpectedError);
      if (turnstileEnabled) resetTurnstile();
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
          <h2 className="text-base font-bold text-foreground mb-1">
            {copy.successTitle}
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            {copy.successMessage}
          </p>
        </div>
        <Link
          href={loginHrefWithRedirect}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-light transition-colors"
        >
          {copy.backToSignIn}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="signup-name" className="block text-[11px] font-bold uppercase tracking-[0.15em] text-muted mb-1.5">
          {copy.fullNameLabel}
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light pointer-events-none" aria-hidden />
          <input
            id="signup-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            disabled={loading}
            placeholder={copy.fullNamePlaceholder}
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-colors"
          />
        </div>
      </div>

      <div>
        <label htmlFor="signup-email" className="block text-[11px] font-bold uppercase tracking-[0.15em] text-muted mb-1.5">
          {copy.emailLabel}
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light pointer-events-none" aria-hidden />
          <input
            id="signup-email"
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

      <div>
        <label htmlFor="signup-password" className="block text-[11px] font-bold uppercase tracking-[0.15em] text-muted mb-1.5">
          {copy.passwordLabel}
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light pointer-events-none" aria-hidden />
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={loading}
            placeholder={copy.passwordPlaceholder}
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-colors"
          />
        </div>
      </div>

      <div>
        <label htmlFor="signup-confirm" className="block text-[11px] font-bold uppercase tracking-[0.15em] text-muted mb-1.5">
          {copy.confirmPasswordLabel}
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light pointer-events-none" aria-hidden />
          <input
            id="signup-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            disabled={loading}
            placeholder={copy.confirmPasswordPlaceholder}
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition-colors"
          />
        </div>
      </div>

      <TurnstileWidget
        siteKey={normalizedTurnstileSiteKey}
        action="signup"
        resetSignal={turnstileResetSignal}
        copy={copy.turnstile}
        onTokenChange={onTurnstileTokenChange}
      />

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3.5 py-3 leading-relaxed">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || (turnstileEnabled && !turnstileToken)}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-light transition-colors disabled:opacity-60 shadow-sm mt-1"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            {copy.submitting}
          </>
        ) : (
          copy.submit
        )}
      </button>

      <p className="text-center text-sm text-muted">
        {copy.alreadyHaveAccount}{" "}
        <Link href={loginHrefWithRedirect} className="font-semibold text-primary hover:text-primary-light transition-colors">
          {copy.signIn}
        </Link>
      </p>
    </form>
  );
}
