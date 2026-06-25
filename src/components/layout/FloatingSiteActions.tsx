"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUp, MessageCircle, PlusCircle, UserPlus } from "lucide-react";
import { usePublicAuth } from "@/components/auth/PublicAuthContext";
import { trackSignUpClick } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export default function FloatingSiteActions() {
  const pathname = usePathname() ?? "/";
  const [showBackToTop, setShowBackToTop] = useState(false);
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isSpanish = pathname === "/es" || pathname.startsWith("/es/");
  const { status } = usePublicAuth();

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div
        aria-hidden="true"
        className="h-[calc(6.75rem+env(safe-area-inset-bottom))] lg:hidden"
      />

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-14px_34px_rgba(26,54,93,0.14)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-md items-center gap-3">
          {status === "authenticated" ? (
            <Link
              href="/dashboard/orders/new"
              className="inline-flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-5 text-[15px] font-bold uppercase tracking-[0.10em] text-white shadow-md shadow-primary/20 transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <PlusCircle className="h-4 w-4 flex-shrink-0" aria-hidden />
              <span>New Order</span>
            </Link>
          ) : (
            <Link
              href={isSpanish ? "/es/signup" : "/signup"}
              onClick={() => trackSignUpClick("mobile_sticky_cta")}
              aria-hidden={status === "loading"}
              tabIndex={status === "loading" ? -1 : undefined}
              className={cn(
                "inline-flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-5 text-[15px] font-bold uppercase tracking-[0.10em] text-white shadow-md shadow-primary/20 transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                status === "loading" && "invisible"
              )}
            >
              <UserPlus className="h-4 w-4 flex-shrink-0" aria-hidden />
              <span>{isSpanish ? "Crear cuenta" : "Sign Up"}</span>
            </Link>
          )}

          <div
            className="inline-flex h-14 min-w-[8rem] items-center justify-center gap-2 rounded-md border border-stone-200 bg-surface px-3 text-primary shadow-sm"
            aria-label={isSpanish ? "Chat de soporte próximamente" : "Support chat coming soon"}
          >
            <MessageCircle className="h-4 w-4 flex-shrink-0 text-secondary-dark" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-[0.10em]">
              {isSpanish ? "Chat pronto" : "Chat soon"}
            </span>
          </div>
        </div>
      </div>

      {showBackToTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] right-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-primary bg-primary text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:bottom-8 lg:right-8"
          aria-label={isSpanish ? "Volver arriba" : "Back to top"}
        >
          <ArrowUp className="h-5 w-5" aria-hidden />
        </button>
      )}
    </>
  );
}
