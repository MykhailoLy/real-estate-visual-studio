"use client";

import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { signOutBrowserSession } from "@/lib/sign-out";

interface SignOutButtonProps {
  className?: string;
  label?: string;
  loadingLabel?: string;
}

// Signs out via the SSR cookie-based Supabase browser client, then
// hard-navigates to /login so the server session cookie is cleared too.
// Always redirects even if signOut throws, so the button never gets stuck.
export default function SignOutButton({
  className,
  label = "Sign out",
  loadingLabel = "Signing out...",
}: SignOutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    await signOutBrowserSession();
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
      {loading ? loadingLabel : label}
    </button>
  );
}
