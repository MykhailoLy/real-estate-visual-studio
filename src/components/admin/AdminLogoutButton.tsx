"use client";

// ============================================================
// AdminLogoutButton
//
// Reusable logout button for admin pages.
// POSTs to /api/admin/logout (which clears the session cookie)
// then navigates to /admin/login.
//
// Uses client-side fetch instead of a plain <form> POST because
// /api/admin/logout returns JSON, not a redirect response.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";

interface AdminLogoutButtonProps {
  className?: string;
}

export default function AdminLogoutButton({ className }: AdminLogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // Cookie is short-lived — navigate away regardless
    }
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={
        className ??
        "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-60"
      }
    >
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
        : <LogOut className="w-4 h-4" aria-hidden />
      }
      Sign out
    </button>
  );
}
