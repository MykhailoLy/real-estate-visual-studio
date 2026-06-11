"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUp, MessageCircle, UserPlus } from "lucide-react";
import { trackButtonClick, trackLeadIntent } from "@/lib/analytics";

export default function FloatingSiteActions() {
  const pathname = usePathname() ?? "/";
  const [showBackToTop, setShowBackToTop] = useState(false);
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  useEffect(() => {
    const updateVisibility = () => {
      setShowBackToTop(window.scrollY > 420);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  if (isAdminRoute) return null;

  const scrollToTop = () => {
    trackButtonClick("Back to top", "floating_action");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div
        aria-hidden="true"
        className="h-[calc(5.75rem+env(safe-area-inset-bottom))] lg:hidden"
      />

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(26,54,93,0.10)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Link
            href="/signup"
            onClick={() => {
              trackButtonClick("Sign Up", "mobile_sticky_cta");
              trackLeadIntent("sign_up", "mobile_sticky_cta");
            }}
            className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold uppercase tracking-[0.10em] text-white shadow-sm transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <UserPlus className="h-4 w-4 flex-shrink-0" aria-hidden />
            <span>Sign Up</span>
          </Link>

          <div
            className="inline-flex h-12 min-w-[7.75rem] items-center justify-center gap-2 rounded-md border border-stone-200 bg-surface px-3 text-primary"
            aria-label="Support chat coming soon"
          >
            <MessageCircle className="h-4 w-4 flex-shrink-0 text-secondary-dark" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-[0.10em]">
              Chat soon
            </span>
          </div>
        </div>
      </div>

      {showBackToTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white/95 text-primary shadow-lg shadow-primary/10 backdrop-blur transition-colors hover:border-primary/30 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:bottom-8 lg:right-8"
          aria-label="Back to top"
        >
          <ArrowUp className="h-4 w-4" aria-hidden />
        </button>
      )}
    </>
  );
}
