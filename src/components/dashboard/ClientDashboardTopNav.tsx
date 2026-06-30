"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Briefcase,
  ChevronDown,
  FileClock,
  FolderOpen,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  PlusCircle,
  Receipt,
  User,
  X,
} from "lucide-react";
import { PicchuSpotLogo, BrandWordmark } from "@/components/brand";
import {
  MarketLanguageSelector,
  getCurrentLanguage,
  getLocaleAwareHref,
  getResourceHref,
  readStoredLanguage,
  resourceMenuItems,
  writeLanguagePreference,
  type SiteLanguage,
} from "@/components/layout/Header";
import { useSupportChat } from "@/components/support/SupportChatProvider";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/client-auth-utils";
import { useDashboardUser } from "./DashboardUserContext";
import SignOutButton from "./SignOutButton";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/jobs", label: "Jobs", icon: Briefcase },
  { href: "/dashboard/orders/new", label: "New Order", icon: PlusCircle },
  { href: "/dashboard/drafts", label: "Drafts", icon: FileClock },
  { href: "/dashboard/files", label: "Files", icon: FolderOpen },
  { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
];

const accountMenuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/jobs", label: "Jobs", icon: Briefcase },
  { href: "/dashboard/orders/new", label: "New Order", icon: PlusCircle },
  { href: "/dashboard/drafts", label: "Drafts", icon: FileClock },
  { href: "/dashboard/profile", label: "My Account", icon: User },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
] as const;

interface PanelPosition {
  top?: number;
  bottom?: number;
  right: number;
  width: number;
  maxHeight: number;
}

interface DashboardAccountMenuProps {
  placement?: "bottom" | "top";
  variant?: "header" | "mobile-bottom";
  className?: string;
}

export default function ClientDashboardTopNav() {
  const pathname = usePathname() ?? "/dashboard";
  const [savedLanguage, setSavedLanguage] = useState<SiteLanguage | null>(null);
  const language = getCurrentLanguage(pathname, savedLanguage);

  useEffect(() => {
    window.queueMicrotask(() => setSavedLanguage(readStoredLanguage()));
  }, []);

  const setLanguage = (nextLanguage: SiteLanguage) => {
    writeLanguagePreference(nextLanguage);
    setSavedLanguage(nextLanguage);
  };

  return (
    <header className="sticky top-0 z-40 flex-shrink-0 border-b border-border bg-white shadow-sm">
      <div className="flex h-14 min-w-0 items-center gap-1.5 px-3 sm:h-16 sm:gap-2 sm:px-6 lg:px-8">
        <Link
          href={getLocaleAwareHref("/", language)}
          aria-label="Open the PicchuSpot public homepage"
          className="flex min-w-0 flex-shrink items-center gap-1.5 sm:gap-2"
        >
          <PicchuSpotLogo
            variant="mark"
            className="h-6 w-auto flex-shrink-0 sm:h-7"
            width={56}
            height={28}
            alt=""
          />
          <BrandWordmark theme="light" className="min-w-0 text-sm sm:text-lg" />
        </Link>

        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          <PublicResourcesMenu language={language} />
          <DashboardAccountMenu className="hidden md:block" />
          <MarketLanguageSelector
            pathname={pathname}
            currentLanguage={language}
            compact
            tight
            onLanguageChange={setLanguage}
            getLanguageOptionHref={() => pathname}
            analyticsLocation="dashboard_header"
          />
        </div>
      </div>

      <DashboardNavigationRow pathname={pathname} />
    </header>
  );
}

function DashboardNavigationRow({ pathname }: { pathname: string }) {
  const { open: supportChatOpen, openSupportChat } = useSupportChat();
  const supportButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div className="border-t border-border bg-primary">
      <nav
        aria-label="Dashboard navigation"
        className="flex h-12 items-center gap-1 overflow-x-auto overscroll-x-contain px-3 [scrollbar-width:none] sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden"
      >
        {DASHBOARD_NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const isNewOrder = item.href === "/dashboard/orders/new";
          const isSupport = item.href === "/dashboard/support";

          const itemClassName = cn(
            "inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary",
            isSupport && "hidden md:inline-flex",
            isNewOrder
              ? "bg-secondary text-primary-dark shadow-sm hover:bg-secondary-light"
              : active
                ? "bg-white/18 text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
          );

          if (isSupport) {
            return (
              <button
                key={item.href}
                ref={supportButtonRef}
                type="button"
                onClick={() => openSupportChat(supportButtonRef.current)}
                aria-label="Open PicchuSpot Assistant"
                aria-expanded={supportChatOpen}
                aria-controls="support-chat-widget"
                className={itemClassName}
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active && !isNewOrder ? "page" : undefined}
              className={itemClassName}
            >
              <item.icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function PublicResourcesMenu({ language }: { language: SiteLanguage }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    right: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const activeItems = resourceMenuItems.filter(
    (item) => item.status !== "coming-soon" && Boolean(item.href)
  );

  const updatePanelPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const gutter = 12;
    const width = Math.min(384, window.innerWidth - gutter * 2);
    const right = Math.max(
      gutter,
      Math.min(
        window.innerWidth - rect.right,
        window.innerWidth - width - gutter
      )
    );
    const top = rect.bottom + 8;
    setPanelPos({
      top,
      right,
      width,
      maxHeight: Math.max(160, window.innerHeight - top - gutter),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePanelPosition);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePanelPosition);
    };
  }, [open, updatePanelPosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          updatePanelPosition();
          setOpen((value) => !value);
        }}
        aria-label={open ? "Close site menu" : "Open site menu"}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-stone-200 text-primary shadow-sm transition-colors hover:border-primary/30 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open &&
        panelPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label="Public information pages"
            style={{
              position: "fixed",
              top: panelPos.top,
              right: panelPos.right,
              width: panelPos.width,
              maxHeight: panelPos.maxHeight,
              zIndex: 10001,
            }}
            className="overflow-y-auto rounded-xl border border-border bg-white p-2 shadow-2xl"
          >
            {activeItems.map((item) => {
              const href = getResourceHref(item, language);
              if (!href) return null;
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground/80 transition-colors hover:bg-surface hover:text-primary focus:outline-none focus-visible:bg-surface focus-visible:text-primary"
                >
                  <Icon className="h-4 w-4 text-secondary-dark" aria-hidden />
                  {language === "es"
                    ? item.esLabel
                    : item.label === "Contact Us"
                      ? "Contact"
                      : item.label}
                </Link>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}

function DashboardAccountAvatar({
  avatarUrl,
  initials,
  large = false,
}: {
  avatarUrl: string | null;
  initials: string;
  large?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-secondary-dark bg-cover bg-center font-bold text-primary-dark shadow-sm",
        large ? "h-9 w-9 text-xs" : "h-7 w-7 text-[10px]"
      )}
      style={avatarUrl ? { backgroundImage: `url("${avatarUrl}")` } : undefined}
      aria-hidden
    >
      {!avatarUrl && initials}
    </span>
  );
}

export function DashboardAccountMenu({
  placement = "bottom",
  variant = "header",
  className,
}: DashboardAccountMenuProps) {
  const pathname = usePathname() ?? "/dashboard";
  const user = useDashboardUser();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelPos, setPanelPos] = useState<PanelPosition | null>(null);

  const displayName = user?.displayName || "Client";
  const firstName =
    user?.profileName || user?.firstName || displayName.split(" ")[0];
  const initials = getInitials(displayName);
  const open = openPath === pathname;
  const mobileBottom = variant === "mobile-bottom";

  const updatePanelPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const gutter = 12;
    const panelGap = 8;
    const width = Math.min(256, window.innerWidth - gutter * 2);
    const right = Math.max(
      gutter,
      Math.min(
        window.innerWidth - rect.right,
        window.innerWidth - width - gutter
      )
    );

    if (placement === "top") {
      const bottom = Math.max(gutter, window.innerHeight - rect.top + panelGap);
      setPanelPos({
        bottom,
        right,
        width,
        maxHeight: Math.max(160, window.innerHeight - bottom - gutter),
      });
      return;
    }

    const top = rect.bottom + panelGap;
    setPanelPos({
      top,
      right,
      width,
      maxHeight: Math.max(160, window.innerHeight - top - gutter),
    });
  }, [placement]);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpenPath(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPath(null);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePanelPosition);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePanelPosition);
    };
  }, [open, updatePanelPosition]);

  return (
    <div
      className={cn(
        "relative min-w-0 flex-shrink-0",
        mobileBottom && "w-full",
        className
      )}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          updatePanelPosition();
          setOpenPath(open ? null : pathname);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${firstName}`}
        className={cn(
          "inline-flex min-w-0 items-center transition-colors focus:outline-none focus-visible:ring-2",
          mobileBottom
            ? "h-[calc(3.5rem+env(safe-area-inset-bottom))] w-full justify-center gap-2 bg-primary px-4 pb-[env(safe-area-inset-bottom)] text-white hover:bg-primary-light focus-visible:ring-inset focus-visible:ring-white"
            : "h-9 flex-shrink-0 gap-1 rounded-lg border border-stone-200 bg-white px-1.5 text-primary shadow-sm hover:border-primary/30 hover:bg-surface focus-visible:ring-primary sm:gap-1.5 sm:pr-2"
        )}
      >
        <DashboardAccountAvatar
          avatarUrl={user?.avatarUrl ?? null}
          initials={initials}
        />
        <span
          className={cn(
            "min-w-0 truncate font-semibold",
            mobileBottom
              ? "max-w-[7.5rem] flex-1 text-left text-sm"
              : "hidden max-w-24 text-xs sm:block"
          )}
        >
          {firstName}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 flex-shrink-0 transition-transform",
            mobileBottom ? "text-white/75" : "text-primary/60",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open &&
        panelPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label="Account"
            style={{
              position: "fixed",
              top: panelPos.top,
              bottom: panelPos.bottom,
              right: panelPos.right,
              width: panelPos.width,
              maxHeight: panelPos.maxHeight,
              zIndex: 10001,
            }}
            className="overflow-y-auto rounded-xl border border-border bg-white py-1 shadow-2xl shadow-black/10"
          >
            <div className="border-b border-border bg-surface/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <DashboardAccountAvatar
                  avatarUrl={user?.avatarUrl ?? null}
                  initials={initials}
                  large
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {displayName}
                  </p>
                  {user?.email && (
                    <p className="truncate text-[11px] text-muted">{user.email}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="py-1">
              {accountMenuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpenPath(null)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground/80 transition-colors hover:bg-surface hover:text-primary focus:outline-none focus-visible:bg-surface focus-visible:text-primary"
                >
                  <item.icon className="h-4 w-4 text-muted" aria-hidden />
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="border-t border-border py-1">
              <SignOutButton
                label="Log Out"
                loadingLabel="Logging out..."
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-muted transition-colors hover:bg-surface hover:text-foreground focus:outline-none focus-visible:bg-surface focus-visible:text-foreground disabled:opacity-60"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
