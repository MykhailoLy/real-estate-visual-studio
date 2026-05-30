"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2, Lock } from "lucide-react";

// ============================================================
// LoginForm — admin password entry
//
// Posts JSON to /api/admin/login. On success the API sets the
// HMAC-signed session cookie and we router.replace() to the
// portfolio admin so the back button doesn't return to login.
//
// The component never reads the password back — we use an
// uncontrolled <input> so React DevTools / leaked memory dumps
// don't carry the value any longer than needed.
// ============================================================

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const form = event.currentTarget;
    const passwordEl = form.elements.namedItem(
      "password"
    ) as HTMLInputElement | null;
    const password = passwordEl?.value ?? "";

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        // Same-origin so the cookie comes back on the response
        // and is stored for subsequent admin requests.
        credentials: "same-origin",
      });

      if (res.ok) {
        // Wipe the field before navigating so the password isn't
        // sitting in the form state if the user hits back.
        if (passwordEl) passwordEl.value = "";
        router.replace("/admin/portfolio");
        // refresh forces the next /admin/portfolio render to use
        // the freshly-set session cookie.
        router.refresh();
        return;
      }

      let message = "Sign in failed.";
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        // ignore JSON parse failure — we already have a sane default
      }
      setError(message);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <label
          htmlFor="admin-password"
          className="block text-xs font-semibold tracking-[0.15em] uppercase text-muted mb-2"
        >
          Password
        </label>
        <div className="relative">
          <span
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-light"
          >
            <Lock className="w-4 h-4" />
          </span>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={loading}
            className="w-full pl-10 pr-3 py-3 rounded-lg border border-border bg-white text-foreground text-sm placeholder:text-muted-light focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            placeholder="Enter admin password"
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 leading-relaxed"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-primary text-white font-bold text-sm hover:bg-primary-light transition-colors disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
