"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import {
  getSupportChatLink,
  supportChatCopy,
  type SupportChatLanguage,
  type SupportChatQuickActionKey,
} from "@/components/support/support-chat-copy";
import {
  buildSupportChatHistory,
  getSupportChatErrorMessage,
  submitSupportChatMessage,
  type SupportChatClientResult,
  type SupportChatMessage,
} from "@/components/support/support-chat-client";
import { cn } from "@/lib/utils";

const MAX_MESSAGE_LENGTH = 2000;

interface SupportChatWidgetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: SupportChatLanguage;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}

export default function SupportChatWidget({
  open,
  onOpenChange,
  language,
  returnFocusRef,
}: SupportChatWidgetProps) {
  const copy = supportChatCopy[language];
  const router = useRouter();
  const dialogId = "support-chat-widget";
  const titleId = useId();
  const desktopTriggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFocusRef = useRef<HTMLButtonElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorResult, setErrorResult] =
    useState<Extract<SupportChatClientResult, { ok: false }> | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);

  const quickActions = useMemo(
    () =>
      [
        "pricing",
        "services",
        "howToOrder",
        "talkToPerson",
      ] satisfies SupportChatQuickActionKey[],
    [],
  );

  const closeChat = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSending(false);
    onOpenChange(false);
    window.setTimeout(() => {
      const focusTarget = isMobile
        ? returnFocusRef?.current ?? lastFocusRef.current
        : lastFocusRef.current ?? returnFocusRef?.current;
      focusTarget?.focus();
    }, 0);
  }, [isMobile, onOpenChange, returnFocusRef]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => {
      if (isMobile) {
        closeButtonRef.current?.focus();
      } else {
        textareaRef.current?.focus();
      }
    }, 0);
  }, [isMobile, open]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open, sending, errorResult]);

  useEffect(() => {
    if (!open || !isMobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, open]);

  useEffect(() => {
    if (!open) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      return;
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeChat();
        return;
      }

      if (event.key === "Tab" && isMobile && panelRef.current) {
        trapFocus(event, panelRef.current);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, [closeChat, isMobile, open]);

  useEffect(() => {
    if (!cooldownUntil) return;

    const update = () => {
      const nextRemaining = Math.max(
        0,
        Math.ceil((cooldownUntil - Date.now()) / 1000),
      );
      setCooldownRemaining(nextRemaining);
      if (nextRemaining <= 0) {
        setCooldownUntil(null);
        setErrorResult(null);
      }
    };

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

  const submitMessage = useCallback(
    async (rawMessage: string) => {
      const trimmedMessage = rawMessage.trim();
      if (!trimmedMessage || sending || cooldownRemaining > 0) return;

      const userMessage = createThreadMessage("user", trimmedMessage, "local");
      const history = buildSupportChatHistory(messages);
      const abortController = new AbortController();
      abortControllerRef.current?.abort();
      abortControllerRef.current = abortController;

      setErrorResult(null);
      setInput("");
      setMessages((current) => [...current, userMessage]);
      setSending(true);

      const result = await submitSupportChatMessage({
        message: trimmedMessage,
        history,
        signal: abortController.signal,
      });

      if (
        abortControllerRef.current !== abortController ||
        abortController.signal.aborted
      ) {
        return;
      }

      abortControllerRef.current = null;
      setSending(false);

      if (result.ok) {
        setMessages((current) => [
          ...current,
          createThreadMessage("assistant", result.message, "remote"),
        ]);
        setErrorResult(null);
        window.setTimeout(() => textareaRef.current?.focus(), 0);
        return;
      }

      if (result.code === "aborted") return;

      setErrorResult(result);
      if (result.code === "rate_limited") {
        const seconds = result.retryAfterSeconds ?? 60;
        setCooldownRemaining(seconds);
        setCooldownUntil(Date.now() + seconds * 1000);
      }
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [cooldownRemaining, messages, sending],
  );

  const handleQuickAction = (action: SupportChatQuickActionKey) => {
    if (action === "pricing" || action === "services") {
      closeChat();
      router.push(getSupportChatLink(language, action));
      return;
    }

    if (action === "howToOrder") {
      void submitMessage(copy.prompts.howToOrder);
      return;
    }

    setErrorResult(null);
    setMessages((current) => [
      ...current,
      {
        ...createThreadMessage(
          "assistant",
          copy.humanSupportMessage,
          "local",
        ),
        localKind: "human_support",
      },
    ]);
  };

  const onComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void submitMessage(input);
  };

  const openFromDesktop = () => {
    lastFocusRef.current = desktopTriggerRef.current;
    onOpenChange(true);
  };

  const errorMessage = errorResult
    ? getSupportChatErrorMessage(language, errorResult, cooldownRemaining)
    : null;
  const sendDisabled = !input.trim() || sending || cooldownRemaining > 0;
  const nearLimit = input.length >= 1800;

  const panel = (
    <>
      {isMobile && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          className="fixed inset-0 z-[70] bg-primary-dark/45 backdrop-blur-[2px] lg:hidden"
          onClick={closeChat}
        />
      )}
      <section
        ref={panelRef}
        id={dialogId}
        role="dialog"
        aria-modal={isMobile ? true : undefined}
        aria-labelledby={titleId}
        aria-label={copy.dialogLabel}
        className={cn(
          "fixed z-[70] flex min-h-0 flex-col overflow-hidden border border-primary/15 bg-white shadow-2xl shadow-primary/25 transition-[opacity,transform] motion-reduce:transition-none",
          "inset-x-0 bottom-0 top-3 rounded-t-2xl lg:inset-auto lg:bottom-6 lg:right-6 lg:h-[min(620px,calc(100dvh-3rem))] lg:w-[400px] lg:rounded-2xl",
        )}
      >
        <div className="flex flex-shrink-0 items-center gap-3 bg-primary px-4 py-4 text-white">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-secondary">
            <MessageCircle className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-bold">
              {copy.headerTitle}
            </h2>
            <p className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-white/80">
              <span
                className="h-2 w-2 rounded-full bg-secondary"
                aria-hidden
              />
              {copy.status}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeChat}
            aria-label={copy.closeAriaLabel}
            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface/70 px-4 py-4">
          <div className="space-y-3" aria-live="polite">
            {[createWelcomeMessage(language), ...messages].map((messageItem) => (
              <MessageBubble
                key={messageItem.id}
                message={messageItem}
                contactHref={getSupportChatLink(language, "contact")}
                contactLabel={copy.contactLinkLabel}
                onContactClick={closeChat}
              />
            ))}
            {sending && (
              <div
                className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm text-muted"
                aria-live="polite"
              >
                <Loader2
                  className="h-4 w-4 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
                {copy.loadingText}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-border bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="mb-3 grid grid-cols-2 gap-2">
            {quickActions.map((action) => {
              const isApiAction = action === "howToOrder";
              return (
                <button
                  key={action}
                  type="button"
                  onClick={() => handleQuickAction(action)}
                  disabled={isApiAction && (sending || cooldownRemaining > 0)}
                  className="min-h-10 rounded-lg border border-primary/15 bg-surface px-3 py-2 text-left text-xs font-bold text-primary transition-colors hover:border-primary/30 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {copy.quickActions[action]}
                </button>
              );
            })}
          </div>

          {errorMessage && (
            <div
              className="mb-3 rounded-lg border border-secondary/35 bg-secondary/10 px-3 py-2 text-sm text-primary"
              aria-live="polite"
            >
              {errorMessage}
            </div>
          )}

          <div className="rounded-xl border border-border bg-white shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
            <label htmlFor={`${dialogId}-composer`} className="sr-only">
              {copy.composerLabel}
            </label>
            <textarea
              ref={textareaRef}
              id={`${dialogId}-composer`}
              value={input}
              onChange={(event) =>
                setInput(event.target.value.slice(0, MAX_MESSAGE_LENGTH))
              }
              onKeyDown={onComposerKeyDown}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={2}
              placeholder={copy.composerPlaceholder}
              className="block max-h-28 min-h-12 w-full resize-none rounded-t-xl border-0 bg-transparent px-3 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-light focus:outline-none"
            />
            <div className="flex items-center justify-between gap-3 px-3 pb-3">
              <span
                className={cn(
                  "text-[11px] text-muted",
                  nearLimit && "font-semibold text-secondary-dark",
                )}
              >
                {nearLimit ? copy.characterCount(input.length) : copy.footerNote}
              </span>
              <button
                type="button"
                onClick={() => void submitMessage(input)}
                disabled={sendDisabled}
                aria-label={sending ? copy.sendingLabel : copy.sendLabel}
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <Loader2
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden
                  />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );

  return (
    <>
      {!open && (
        <button
          ref={desktopTriggerRef}
          type="button"
          onClick={openFromDesktop}
          aria-expanded={open}
          aria-controls={dialogId}
          aria-label={copy.launcherAriaLabel}
          className="fixed bottom-6 right-6 z-[70] hidden min-h-11 items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white shadow-xl shadow-primary/25 transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:inline-flex"
        >
          <MessageCircle className="h-5 w-5 text-secondary" aria-hidden />
          {copy.launcherLabel}
        </button>
      )}

      {open &&
        (isMobile && typeof document !== "undefined"
          ? createPortal(panel, document.body)
          : panel)}
    </>
  );
}

function MessageBubble({
  message,
  contactHref,
  contactLabel,
  onContactClick,
}: {
  message: SupportChatMessage;
  contactHref: string;
  contactLabel: string;
  onContactClick: () => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
          isUser
            ? "rounded-br-md bg-primary text-white"
            : "rounded-bl-md border border-border bg-white text-foreground",
        )}
      >
        {!isUser && (
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase text-secondary-dark">
            <Sparkles className="h-3 w-3" aria-hidden />
            PicchuSpot
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.localKind === "human_support" && (
          <Link
            href={contactHref}
            onClick={onContactClick}
            className="mt-2 inline-flex text-sm font-bold text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {contactLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

function createWelcomeMessage(language: SupportChatLanguage): SupportChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    content: supportChatCopy[language].initialMessage,
    origin: "local",
    status: "complete",
    localKind: "welcome",
  };
}

function createThreadMessage(
  role: SupportChatMessage["role"],
  content: string,
  origin: SupportChatMessage["origin"],
): SupportChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    origin,
    status: "complete",
  };
}

function trapFocus(event: globalThis.KeyboardEvent, container: HTMLElement) {
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("disabled"));

  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first?.focus();
  }
}
