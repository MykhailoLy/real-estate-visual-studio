"use client";

import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

interface SignOutButtonProps {
  className?: string;
}

// Signs out via the SSR cookie-based Supabase browser client, then
// hard-navigates to /login so the server session cookie is cleared too.
// Always redirects even if signOut throws, so the button never gets stuck.
export default function SignOutButton({ className }: SignOutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Continue regardless — we still redirect to login
    }
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      role="menuitem"
      onClick={handleSignOut}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
      ) : (
        <LogOut className="w-4 h-4" aria-hidden />
      )}
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
