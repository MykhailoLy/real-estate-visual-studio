"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, MessageCircle, UserPlus } from "lucide-react";
import { usePublicAuth } from "@/components/auth/PublicAuthContext";
import PublicAccountMenu from "@/components/auth/PublicAccountMenu";
import { detectSupportChatLanguage } from "@/components/support/support-chat-client";
import { supportChatCopy } from "@/components/support/support-chat-copy";
import { useSupportChat } from "@/components/support/SupportChatProvider";
import { trackSignUpClick } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export default function FloatingSiteActions() {
  const pathname = usePathname() ?? "/";
  const [showBackToTop, setShowBackToTop] = useState(false);
  const mobileChatTriggerRef = useRef<HTMLButtonElement | null>(null);
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const language = detectSupportChatLanguage(pathname);
  const isSpanish = language === "es";
  const {
    open: chatOpen,
    liveSupportActive,
    launcherMode,
    openSupportChat,
  } = useSupportChat();
  const showPublicLauncher = launcherMode === "public";
  const chatCopy = supportChatCopy[language];
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
      {!liveSupportActive && (
        <div
          aria-hidden="true"
          className="h-[calc(3.5rem+env(safe-area-inset-bottom))] lg:hidden"
        />
      )}

      {!liveSupportActive && !(showPublicLauncher && chatOpen) && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 grid border-t border-primary/15 shadow-[0_-8px_24px_rgba(7,26,43,0.16)] lg:hidden",
            showPublicLauncher ? "grid-cols-2" : "grid-cols-1"
          )}
        >
          {status === "authenticated" ? (
            <PublicAccountMenu placement="top" variant="mobile-action" />
          ) : (
            <Link
              href={isSpanish ? "/es/signup" : "/signup"}
              onClick={() => trackSignUpClick("mobile_sticky_cta")}
              aria-hidden={status === "loading"}
              tabIndex={status === "loading" ? -1 : undefined}
              className={cn(
                "inline-flex h-[calc(3.5rem+env(safe-area-inset-bottom))] min-w-0 items-center justify-center gap-2 bg-primary px-4 pb-[env(safe-area-inset-bottom)] text-[14px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white",
                status === "loading" && "pointer-events-none text-transparent"
              )}
            >
              <UserPlus className="h-4 w-4 flex-shrink-0" aria-hidden />
              <span>{isSpanish ? "Crear cuenta" : "Sign Up"}</span>
            </Link>
          )}

          {showPublicLauncher && (
            <button
              ref={mobileChatTriggerRef}
              type="button"
              onClick={() => openSupportChat(mobileChatTriggerRef.current)}
              className="inline-flex h-[calc(3.5rem+env(safe-area-inset-bottom))] min-w-0 items-center justify-center gap-2 bg-surface px-3 pb-[env(safe-area-inset-bottom)] text-primary transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              aria-label={chatCopy.launcherAriaLabel}
              aria-expanded={chatOpen}
              aria-controls="support-chat-widget"
            >
              <MessageCircle
                className="h-4 w-4 flex-shrink-0 text-secondary-dark"
                aria-hidden
              />
              <span className="truncate text-xs font-bold uppercase tracking-[0.10em]">
                {chatCopy.mobileLauncherLabel}
              </span>
            </button>
          )}
        </div>
      )}

      {showBackToTop && !liveSupportActive && !(showPublicLauncher && chatOpen) && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] right-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-white text-primary shadow-xl shadow-primary/20 transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:bottom-24 lg:right-8"
          aria-label={isSpanish ? "Volver arriba" : "Back to top"}
        >
          <ArrowUp className="h-5 w-5" aria-hidden />
        </button>
      )}
    </>
  );
}
