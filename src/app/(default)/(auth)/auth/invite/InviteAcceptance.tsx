"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { safeInternalPath } from "@/lib/safe-redirect";
import ResetPasswordForm from "../../reset-password/ResetPasswordForm";

export default function InviteAcceptance() {
  const acceptance = useRef<Promise<string> | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // An admin invitation has no recipient PKCE verifier. The standard Auth
    // ConfirmationURL returns an implicit session in the fragment instead.
    // Consume it once (including React Strict Mode), before creating the SDK
    // client, and remove tokens from browser history immediately.
    if (!acceptance.current) {
      acceptance.current = (async () => {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const next = safeInternalPath(new URLSearchParams(window.location.search).get("next"));
        window.history.replaceState(window.history.state, "", window.location.pathname);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (params.has("error") || params.get("type") !== "invite" || !access_token || !refresh_token) {
          throw new Error("Invalid invitation");
        }
        const supabase = createBrowserSupabaseClient();
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error || !data.session) throw new Error("Invitation session unavailable");
        const { data: verified, error: verifyError } = await supabase.auth.getUser();
        if (verifyError || !verified.user || verified.user.is_anonymous) throw new Error("Invitation session unverified");
        // This marker only selects onboarding; the callback verifies the cookie
        // session again. No browser value can grant Partner status.
        return `/auth/callback?type=invite&next=${encodeURIComponent(next)}`;
      })();
    }
    let active = true;
    acceptance.current.then((path) => { if (active) setNextPath(path); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  if (failed) return (
    <div className="space-y-3 text-sm">
      <p role="alert" className="text-foreground">This invitation could not be accepted. It may have expired or already been used. Ask your PicchuSpot contact to check your account.</p>
      <Link href="/login" className="font-semibold text-primary underline">Back to sign in</Link>
    </div>
  );
  if (!nextPath) return <p role="status" className="text-sm text-muted">Accepting invitation…</p>;
  return <ResetPasswordForm nextPath={nextPath} />;
}
