"use client";

import { MessageCircle, User } from "lucide-react";
import { useRef } from "react";
import ClientPortalLink from "./ClientPortalLink";
import { useSupportChat } from "@/components/support/SupportChatProvider";

/** Portal-only mobile utility actions; primary navigation stays in the drawer. */
export default function ClientDashboardMobileUtilityBar() {
  const chatTriggerRef = useRef<HTMLButtonElement | null>(null);
  const { open, openSupportChat } = useSupportChat();

  return (
    <div
      aria-label="Client portal quick actions"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-primary/15 bg-white shadow-[0_-8px_24px_rgba(7,26,43,0.16)] lg:hidden"
    >
      <ClientPortalLink
        href="/dashboard/profile"
        className="inline-flex h-[calc(3.5rem+env(safe-area-inset-bottom))] min-w-0 items-center justify-center gap-2 border-r border-border px-4 pb-[env(safe-area-inset-bottom)] text-sm font-bold text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <User className="h-4 w-4 flex-shrink-0" aria-hidden />
        <span>My Account</span>
      </ClientPortalLink>
      <button
        ref={chatTriggerRef}
        type="button"
        onClick={() => openSupportChat(chatTriggerRef.current)}
        aria-label="Open PicchuSpot support chat"
        aria-expanded={open}
        aria-controls="support-chat-widget"
        className="inline-flex h-[calc(3.5rem+env(safe-area-inset-bottom))] min-w-0 items-center justify-center gap-2 bg-surface px-4 pb-[env(safe-area-inset-bottom)] text-sm font-bold text-primary transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <MessageCircle className="h-4 w-4 flex-shrink-0 text-secondary-dark" aria-hidden />
        <span>Chat</span>
      </button>
    </div>
  );
}
