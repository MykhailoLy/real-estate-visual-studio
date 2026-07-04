"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, type FormEvent, type MouseEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2, Mail, Lock } from "lucide-react";
import TurnstileWidget from "@/components/auth/TurnstileWidget";
import {
  DEFAULT_TURNSTILE_COPY,
  normalizeTurnstileSiteKey,
  type TurnstileCopy,
} from "@/components/auth/turnstile";
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
  magicLinkSubmit: string;
  magicLinkSubmitting: string;
  magicLinkSuccessTitle: string;
  magicLinkSuccessMessage: string;
  magicLinkMissingEmail: string;
  noAccount: string;
  createAccount: string;
  invalidCredentials: string;
  unexpectedError: string;
  turnstile: TurnstileCopy;
};

const DEFAULT_COPY: LoginFormCopy = {
  emailLabel: "Email address",
  emailPlaceholder: "you@example.com",
  passwordLabel: "Password",
  passwordPlaceholder: "Your password",
  forgotPassword: "Forgot password?",
  submit: "Sign in to your account",
  submitting: "Signing in...",
  magicLinkSubmit: "Email me a sign-in link",
  magicLinkSubmitting: "Sending sign-in link...",
  magicLinkSuccessTitle: "Check your inbox",
  magicLinkSuccessMessage:
    "If an account exists for that email, we'll send a sign-in link shortly. Check your inbox and spam folder.",
  magicLinkMissingEmail: "Enter your email address.",
  noAccount: "Don't have an account?",
  createAccount: "Create one",
  invalidCredentials: "Incorrect email or password. Please try again.",
  unexpectedError: "An unexpected error occurred. Please try again.",
  turnstile: DEFAULT_TURNSTILE_COPY,
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

function buildAuthCallbackUrl(redirectTo: string): string {
  const callbackUrl = new URL(`${window.location.origin}/auth/callback`);
  if (redirectTo !== "/dashboard") {
    callbackUrl.searchParams.set("next", redirectTo);
  }

  return callbackUrl.toString();
}

function isNonEnumeratingMagicLinkError(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes("signup not allowed") ||
    lowerMessage.includes("signups not allowed") ||
    lowerMessage.includes("user not found") ||
    lowerMessage.includes("account not found") ||
    lowerMessage.includes("email not found") ||
    lowerMessage.includes("does not exist")
  );
}

// ── component ─────────────────────────────────────────────────

type LoginPendingAction = "password" | "magic-link";

export default function LoginForm({
  copy = DEFAULT_COPY,
  signupHref = "/signup",
  forgotPasswordHref = "/forgot-password",
  turnstileSiteKey,
}: {
  copy?: LoginFormCopy;
  signupHref?: string;
  forgotPasswordHref?: string;
  turnstileSiteKey?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeInternalPath(searchParams.get("redirectTo"));
  const signupHrefWithRedirect = withRedirect(signupHref, redirectTo);
  const normalizedTurnstileSiteKey = normalizeTurnstileSiteKey(turnstileSiteKey);
  const turnstileEnabled = Boolean(normalizedTurnstileSiteKey);

  // Show inline error forwarded from /auth/callback (e.g. expired link)
  const callbackError = searchParams.get("error");

  const [pendingAction, setPendingAction] =
    useState<LoginPendingAction | null>(null);
  const [error, setError] = useState<string | null>(callbackError ?? null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const loading = pendingAction !== null;

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

    const captchaToken = turnstileEnabled ? turnstileToken : null;
    if (turnstileEnabled && !captchaToken) {
      setError(copy.turnstile.required);
      return;
    }

    setPendingAction("password");

    const form = e.currentTarget;
    const email    = (form.elements.namedItem("email")    as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    try {
      const supabase = createBrowserSupabaseClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      });

      if (authError) {
        setError(
          authError.message === "Invalid login credentials"
            ? copy.invalidCredentials
            : authError.message
        );
        if (turnstileEnabled) resetTurnstile();
        return;
      }

      // signInWithPassword writes the session cookie via @supabase/ssr,
      // so the proxy will see a valid session on the next request.
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError(copy.unexpectedError);
      if (turnstileEnabled) resetTurnstile();
    } finally {
      setPendingAction(null);
    }
  }

  async function onMagicLinkClick(e: MouseEvent<HTMLButtonElement>) {
    if (loading) return;
    setError(null);

    const form = e.currentTarget.form;
    const email = (
      form?.elements.namedItem("email") as HTMLInputElement | null
    )?.value.trim();

    if (!email) {
      setError(copy.magicLinkMissingEmail);
      return;
    }

    const captchaToken = turnstileEnabled ? turnstileToken : null;
    if (turnstileEnabled && !captchaToken) {
      setError(copy.turnstile.required);
      return;
    }

    setPendingAction("magic-link");

    try {
      const supabase = createBrowserSupabaseClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: buildAuthCallbackUrl(redirectTo),
          shouldCreateUser: false,
          ...(captchaToken ? { captchaToken } : {}),
        },
      });

      if (authError) {
        if (turnstileEnabled) resetTurnstile();

        if (isNonEnumeratingMagicLinkError(authError.message)) {
          setMagicLinkSent(true);
          return;
        }

        setError(authError.message);
        return;
      }

      setMagicLinkSent(true);
    } catch {
      setError(copy.unexpectedError);
      if (turnstileEnabled) resetTurnstile();
    } finally {
      setPendingAction(null);
    }
  }

  if (magicLinkSent) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="text-center py-4 space-y-4"
      >
        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground mb-1">
            {copy.magicLinkSuccessTitle}
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            {copy.magicLinkSuccessMessage}
          </p>
        </div>
      </div>
    );
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

      <TurnstileWidget
        siteKey={normalizedTurnstileSiteKey}
        action="login"
        resetSignal={turnstileResetSignal}
        copy={copy.turnstile}
        onTokenChange={onTurnstileTokenChange}
      />

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
        disabled={loading || (turnstileEnabled && !turnstileToken)}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-light transition-colors disabled:opacity-60 shadow-sm"
      >
        {pendingAction === "password" ? (
          <><Loader2 className="w-4 h-4 animate-spin" aria-hidden />{copy.submitting}</>
        ) : (
          copy.submit
        )}
      </button>

      <button
        type="button"
        onClick={onMagicLinkClick}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-primary/30 bg-white text-primary font-bold text-sm hover:bg-primary/5 transition-colors disabled:opacity-60 shadow-sm"
      >
        {pendingAction === "magic-link" ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            {copy.magicLinkSubmitting}
          </>
        ) : (
          <>
            <Mail className="w-4 h-4" aria-hidden />
            {copy.magicLinkSubmit}
          </>
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
