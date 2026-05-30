"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

// ── helpers ──────────────────────────────────────────────────

/**
 * Validates a redirectTo value so we never redirect to an external URL.
 * Must start with "/" but NOT "//" (protocol-relative open-redirect).
 */
function safeRedirectTo(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

// ── component ─────────────────────────────────────────────────

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectTo(searchParams.get("redirectTo"));

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
            ? "Incorrect email or password. Please try again."
            : authError.message
        );
        return;
      }

      // signInWithPassword writes the session cookie via @supabase/ssr,
      // so the proxy will see a valid session on the next request.
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
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
          Email address
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
            placeholder="you@example.com"
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
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-[12px] font-semibold text-primary hover:text-primary-light transition-colors"
          >
            Forgot password?
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
            placeholder="Your password"
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
          <><Loader2 className="w-4 h-4 animate-spin" aria-hidden />Signing in…</>
        ) : (
          "Sign in to your account"
        )}
      </button>

      <p className="text-center text-sm text-muted">
        Don&rsquo;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-primary hover:text-primary-light transition-colors">
          Create one
        </Link>
      </p>
    </form>
  );
}
