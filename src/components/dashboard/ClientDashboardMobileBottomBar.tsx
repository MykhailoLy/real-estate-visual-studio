"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";
import { LifeBuoy } from "lucide-react";
import { useSupportChat } from "@/components/support/SupportChatProvider";
import { cn } from "@/lib/utils";
import { DashboardAccountMenu } from "./ClientDashboardTopNav";

export default function ClientDashboardMobileBottomBar() {
  const pathname = usePathname() ?? "/dashboard";
  const supportActive = pathname.startsWith("/dashboard/support");
  const {
    open: supportChatOpen,
    liveSupportActive,
    launcherMode,
    openSupportChat,
  } = useSupportChat();
  const supportButtonRef = useRef<HTMLButtonElement | null>(null);
  const showSupportButton = launcherMode === "dashboard";

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 grid border-t border-primary/15 shadow-[0_-8px_24px_rgba(26,54,93,0.16)] md:hidden",
        showSupportButton ? "grid-cols-2" : "grid-cols-1"
      )}
    >
      <DashboardAccountMenu placement="top" variant="mobile-bottom" />

      {showSupportButton && (
        <button
          ref={supportButtonRef}
          type="button"
          onClick={() => openSupportChat(supportButtonRef.current)}
          aria-label="Open PicchuSpot Assistant"
          aria-expanded={liveSupportActive ? undefined : supportChatOpen}
          aria-controls={liveSupportActive ? undefined : "support-chat-widget"}
          className={cn(
            "inline-flex h-[calc(3.5rem+env(safe-area-inset-bottom))] min-w-0 items-center justify-center gap-2 px-3 pb-[env(safe-area-inset-bottom)] text-[14px] font-bold uppercase tracking-[0.08em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
            supportActive
              ? "bg-secondary text-primary-dark"
              : "bg-surface text-primary hover:bg-white"
          )}
        >
          <LifeBuoy
            className={cn(
              "h-4 w-4 flex-shrink-0",
              supportActive ? "text-primary-dark" : "text-secondary-dark"
            )}
            aria-hidden
          />
          <span className="truncate">Support</span>
        </button>
      )}
    </div>
  );
}
