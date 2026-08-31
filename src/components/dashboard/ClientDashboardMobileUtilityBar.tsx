"use client";

import { ChevronUp, MessageCircle, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ClientPortalLink from "./ClientPortalLink";
import SignOutButton from "./SignOutButton";
import { useSupportChat } from "@/components/support/SupportChatProvider";

/** Portal-only mobile utility actions; primary navigation stays in the drawer. */
export default function ClientDashboardMobileUtilityBar() {
  const [accountOpen, setAccountOpen] = useState(false);
  const accountTriggerRef = useRef<HTMLButtonElement | null>(null);
  const accountMenuCloseRef = useRef<HTMLButtonElement | null>(null);
  const chatTriggerRef = useRef<HTMLButtonElement | null>(null);
  const { open, openSupportChat } = useSupportChat();

  useEffect(() => {
    if (!accountOpen) return;

    window.queueMicrotask(() => accountMenuCloseRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        accountTriggerRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  return (
    <>
      {accountOpen && (
        <div
          id="client-dashboard-mobile-account-menu"
          role="menu"
          aria-label="Account actions"
          className="fixed inset-x-4 bottom-[calc(3.375rem+env(safe-area-inset-bottom))] z-40 overflow-hidden rounded-xl border border-border bg-white shadow-2xl shadow-primary/20 lg:hidden"
        >
          <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
            <div>
              <p className="text-sm font-bold text-primary">Account</p>
              <p className="mt-0.5 text-xs text-muted">Manage your PicchuSpot profile.</p>
            </div>
            <button
              ref={accountMenuCloseRef}
              type="button"
              onClick={() => setAccountOpen(false)}
              aria-label="Close account menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ivory hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="p-2">
            <ClientPortalLink
              href="/dashboard/profile"
              role="menuitem"
              onClick={() => setAccountOpen(false)}
              className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-2.5 text-foreground transition-colors hover:bg-ivory focus:outline-none focus-visible:bg-ivory focus-visible:ring-2 focus-visible:ring-primary"
            >
              <User className="h-4 w-4 flex-shrink-0 text-secondary-dark" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">My Account</span>
                <span className="mt-0.5 block text-xs text-muted">Edit account</span>
              </span>
            </ClientPortalLink>
            <SignOutButton
              label="Log Out"
              loadingLabel="Logging out..."
              className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-ivory hover:text-primary focus:outline-none focus-visible:bg-ivory focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            />
          </div>
        </div>
      )}

      <div
        aria-label="Client portal quick actions"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-primary-light bg-primary text-white shadow-[0_-8px_24px_rgba(7,26,43,0.24)] lg:hidden"
      >
        <button
          ref={accountTriggerRef}
          id="client-dashboard-mobile-account-trigger"
          type="button"
          onClick={() => setAccountOpen((value) => !value)}
          aria-label={accountOpen ? "Close account menu" : "Open account menu"}
          aria-expanded={accountOpen}
          aria-haspopup="menu"
          aria-controls="client-dashboard-mobile-account-menu"
          className="inline-flex h-[calc(2.875rem+env(safe-area-inset-bottom))] min-w-0 items-center justify-center gap-2 border-r border-white/15 px-3 pb-[env(safe-area-inset-bottom)] text-sm font-bold transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
        >
          <User className="h-4 w-4 flex-shrink-0 text-secondary" aria-hidden />
          <span>Account</span>
          <ChevronUp
            className={`h-3.5 w-3.5 flex-shrink-0 text-white/70 transition-transform ${accountOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        <button
          ref={chatTriggerRef}
          type="button"
          onClick={() => openSupportChat(chatTriggerRef.current)}
          aria-label="Open PicchuSpot support chat"
          aria-expanded={open}
          aria-controls="support-chat-widget"
          className="inline-flex h-[calc(2.875rem+env(safe-area-inset-bottom))] min-w-0 items-center justify-center gap-2 bg-surface px-3 pb-[env(safe-area-inset-bottom)] text-primary transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <MessageCircle className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden />
          <span className="truncate text-xs font-bold uppercase tracking-[0.10em]">Chat</span>
        </button>
      </div>
    </>
  );
}
