"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase";

interface SignOutButtonProps {
  className?: string;
}

// Signs out via the Supabase browser client (clears localStorage session)
// then hard-navigates to /login. We use router.replace so the back button
// doesn't return to the dashboard after sign-out.
export default function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      await supabase.auth.signOut();
    } catch {
      // Continue regardless — we still redirect to login
    }
    router.replace("/login");
    router.refresh();
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
