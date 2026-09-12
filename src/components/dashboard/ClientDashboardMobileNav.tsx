"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type RefObject } from "react";
import { ArrowUpRight, User, X } from "lucide-react";
import { PicchuSpotLogo, BrandWordmark } from "@/components/brand";
import {
  MarketLanguageSelector,
  type SiteLanguage,
} from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/client-auth-utils";
import { DASHBOARD_NAV_ITEMS } from "./dashboard-nav-items";
import { useDashboardUser } from "./DashboardUserContext";
import SignOutButton from "./SignOutButton";
import ClientPortalLink from "./ClientPortalLink";

interface ClientDashboardMobileNavProps {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  language: SiteLanguage;
  onLanguageChange: (language: SiteLanguage) => void;
}

export default function ClientDashboardMobileNav({
  open,
  onClose,
  triggerRef,
  language,
  onLanguageChange,
}: ClientDashboardMobileNavProps) {
  const pathname = usePathname() ?? "/dashboard";
  const user = useDashboardUser();
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    window.queueMicrotask(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [onClose, open, triggerRef]);

  if (!open) return null;

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const displayName = user?.displayName || "Client";
  const email       = user?.email       || "";
  const initials    = getInitials(user?.profileName || displayName);
  const isLiveUser  = Boolean(user?.email && !user?.isQaPreview);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
        onClick={onClose}
        aria-hidden
      />

      <div
        id="client-dashboard-mobile-menu"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard navigation menu"
        className="fixed inset-y-0 right-0 z-50 flex w-[min(21rem,calc(100vw-2rem))] flex-col bg-white shadow-2xl lg:hidden"
      >
        {/* Header */}
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-white px-4">
          <div className="flex items-center gap-2">
            <PicchuSpotLogo
              variant="mark"
              className="h-7 w-auto flex-shrink-0"
              width={56}
              height={28}
              alt=""
            />
            <BrandWordmark theme="light" className="text-lg" />
            <span className="inline-flex items-center rounded border border-secondary/40 bg-secondary/10 px-1.5 py-0.5 text-dashboard-kicker font-bold uppercase text-primary">
              Portal
            </span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-stone-200 bg-white text-primary transition-colors hover:border-primary/30 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        {/* Identity strip */}
        <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-secondary-dark shadow-sm">
            <span className="text-xs font-bold text-primary">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 break-words text-dashboard-action font-bold text-foreground">{user?.profileName || displayName}</p>
            <p className="break-all text-dashboard-metadata text-muted">{email || "Not signed in"}</p>
          </div>
          {isLiveUser ? (
            <span className="ml-auto inline-flex flex-shrink-0 items-center rounded border border-emerald-200/60 bg-emerald-50 px-1.5 py-0.5 text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-emerald-700">
              Live
            </span>
          ) : (
            <span className="ml-auto inline-flex flex-shrink-0 items-center rounded border border-amber-200/60 bg-amber-50 px-1.5 py-0.5 text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-amber-700">
              Demo
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <nav aria-label="Dashboard navigation" className="space-y-0.5 px-2 py-3">
            <p className="mb-1.5 select-none px-3 text-dashboard-kicker font-bold uppercase text-muted-light">Menu</p>
            {DASHBOARD_NAV_ITEMS.map((item) => {
              const active = isActive(item.href, item.exact);
              const isNewOrder = item.href === "/dashboard/orders/new";
              return (
                <ClientPortalLink
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-dashboard-action font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    isNewOrder
                      ? cn(
                          "mt-1 border border-secondary bg-secondary text-primary hover:bg-secondary-light",
                          active && "ring-2 ring-primary/30",
                        )
                      : active
                      ? "bg-primary text-white shadow-sm"
                      : "text-foreground/65 hover:text-foreground hover:bg-surface"
                  )}
                >
                  <item.icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isNewOrder ? "text-primary" : active ? "text-white" : "text-muted-light"
                    )}
                    aria-hidden
                  />
                  {item.label}
                  {active && <span className="sr-only">(current page)</span>}
                </ClientPortalLink>
              );
            })}
          </nav>

          <div className="mx-4 border-t border-border" />
          <div className="px-4 py-4">
            <p className="mb-2 text-dashboard-kicker font-bold uppercase text-muted-light">
              Market, currency & language
            </p>
            <MarketLanguageSelector
              pathname={pathname}
              currentLanguage={language}
              placement="panel"
              className="w-full [&>button>span]:text-dashboard-action"
              onNavigate={onClose}
              onLanguageChange={onLanguageChange}
              getLanguageOptionHref={() => pathname}
              analyticsLocation="dashboard_mobile_menu"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 space-y-0.5 border-t border-border px-2 py-2">
          <ClientPortalLink
            href="/dashboard/profile"
            onClick={onClose}
            className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-dashboard-action font-semibold text-muted transition-colors hover:bg-surface hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <User className="h-4 w-4 flex-shrink-0" aria-hidden />
            My Account
          </ClientPortalLink>
          <Link
            href="/"
            onClick={onClose}
            className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-dashboard-action font-semibold text-muted transition-colors hover:bg-surface hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowUpRight className="w-4 h-4 flex-shrink-0" aria-hidden />
            Back to website
          </Link>
          <SignOutButton
            className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-dashboard-action font-semibold text-muted transition-colors hover:bg-surface hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          />
        </div>
      </div>
    </>
  );
}
