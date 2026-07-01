"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import SupportChatWidget from "@/components/support/SupportChatWidget";
import {
  detectSupportChatLanguage,
  getSupportChatLauncherMode,
} from "@/components/support/support-chat-client";

interface SupportChatContextValue {
  open: boolean;
  liveSupportActive: boolean;
  launcherMode: "public" | "dashboard" | "none";
  supportChatVisible: boolean;
  openSupportChat: (returnFocusElement?: HTMLButtonElement | null) => void;
}

const SupportChatContext = createContext<SupportChatContextValue | null>(null);

export function SupportChatProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [chatOpen, setChatOpen] = useState(false);
  const [liveSupportActive, setLiveSupportActive] = useState(false);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const language = detectSupportChatLanguage(pathname);
  const launcherMode = getSupportChatLauncherMode(pathname);
  const supportChatVisible = launcherMode !== "none";

  useEffect(() => {
    if (!supportChatVisible) {
      window.queueMicrotask(() => setChatOpen(false));
    }
  }, [supportChatVisible]);

  useEffect(() => {
    if (!liveSupportActive) return;

    let cancelled = false;
    let setVisibility: ((visible: boolean) => void) | null = null;

    const hideActiveCrisp = () => {
      try {
        setVisibility?.(false);
      } catch {
        // Native Crisp visibility should never interrupt route transitions.
      }
    };

    void import("@/components/support/crisp-support-client")
      .then(({ setActiveCrispSupportVisibility }) => {
        setVisibility = setActiveCrispSupportVisibility;
        try {
          setActiveCrispSupportVisibility(cancelled ? false : supportChatVisible);
        } catch {
          // A local visibility failure should not interrupt page navigation.
        }
      })
      .catch(() => {
        // A local chunk failure should not interrupt page navigation.
      });

    return () => {
      cancelled = true;
      hideActiveCrisp();
    };
  }, [liveSupportActive, supportChatVisible]);

  const value = useMemo<SupportChatContextValue>(
    () => ({
      open: chatOpen,
      liveSupportActive,
      launcherMode,
      supportChatVisible,
      openSupportChat(returnFocusElement) {
        returnFocusRef.current = returnFocusElement ?? null;
        if (liveSupportActive) {
          void import("@/components/support/crisp-support-client")
            .then(({ openActiveCrispSupportChat }) => {
              openActiveCrispSupportChat();
            })
            .catch(() => {
              // A local chunk failure should not interrupt dashboard navigation.
            });
          return;
        }

        setChatOpen(true);
      },
    }),
    [chatOpen, launcherMode, liveSupportActive, supportChatVisible],
  );

  return (
    <SupportChatContext.Provider value={value}>
      {children}
      {supportChatVisible && !liveSupportActive && (
        <SupportChatWidget
          open={chatOpen}
          onOpenChange={setChatOpen}
          language={language}
          returnFocusRef={returnFocusRef}
          onLiveSupportActiveChange={setLiveSupportActive}
          showLauncher={launcherMode === "public"}
        />
      )}
    </SupportChatContext.Provider>
  );
}

export function useSupportChat() {
  const context = useContext(SupportChatContext);
  if (!context) {
    throw new Error("useSupportChat must be used within SupportChatProvider.");
  }
  return context;
}
