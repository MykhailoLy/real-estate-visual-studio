"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  Menu,
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
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/client-auth-utils";
import { useDashboardUser } from "./DashboardUserContext";
import SignOutButton from "./SignOutButton";
import ClientPortalLink from "./ClientPortalLink";
import ClientDashboardMobileNav from "./ClientDashboardMobileNav";
import { DASHBOARD_NAV_ITEMS } from "./dashboard-nav-items";

const DASHBOARD_HEADER_HORIZONTAL_CLASSNAME =
  "w-full px-4 sm:px-6 lg:px-8 xl:px-5 2xl:px-10";

const accountMenuItems = [
  { href: "/dashboard/profile", label: "My Account", icon: User },
] as const;

interface PanelPosition {
  top: number;
  right: number;
  width: number;
  maxHeight: number;
}

interface DashboardAccountMenuProps {
  className?: string;
}

export default function ClientDashboardTopNav() {
  const pathname = usePathname() ?? "/dashboard";
  const user = useDashboardUser();
  const [savedLanguage, setSavedLanguage] = useState<SiteLanguage | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const language = getCurrentLanguage(pathname, savedLanguage);

  useEffect(() => {
    window.queueMicrotask(() => setSavedLanguage(readStoredLanguage()));
  }, []);

  const setLanguage = (nextLanguage: SiteLanguage) => {
    writeLanguagePreference(nextLanguage);
    setSavedLanguage(nextLanguage);
  };
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  return (
    <header className="sticky top-0 z-40 flex-shrink-0 border-b border-border bg-white">
      <div
        className={cn(
          DASHBOARD_HEADER_HORIZONTAL_CLASSNAME,
          "flex h-14 min-w-0 items-center gap-2",
        )}
      >
        <Link
          href={getLocaleAwareHref("/", language)}
          aria-label="Open the PicchuSpot public homepage"
          className="flex min-h-11 min-w-0 flex-shrink items-center gap-2"
        >
          <PicchuSpotLogo
            variant="mark"
            className="h-7 w-auto flex-shrink-0 sm:h-8"
            width={64}
            height={32}
            alt=""
          />
          <BrandWordmark
            theme="light"
            className="min-w-0 text-xl sm:text-[21px] xl:text-[22px]"
          />
        </Link>

        {user?.isQaPreview && (
          <span className="ml-auto inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-dashboard-metadata font-bold uppercase tracking-[0.08em] text-amber-800">
            QA Preview
          </span>
        )}

        <div
          className={cn(
            "hidden min-w-0 items-center gap-1.5 md:gap-2 lg:flex",
            !user?.isQaPreview && "ml-auto",
          )}
        >
          <PublicResourcesMenu language={language} />
          <MarketLanguageSelector
            pathname={pathname}
            currentLanguage={language}
            className="[&>button]:h-10 [&>button]:rounded-md [&>button]:shadow-none [&>button>span]:text-dashboard-action"
            compact
            tight
            onLanguageChange={setLanguage}
            getLanguageOptionHref={() => pathname}
            analyticsLocation="dashboard_header"
          />
          <DashboardAccountMenu />
        </div>

        <button
          ref={mobileMenuButtonRef}
          type="button"
          onClick={() => setMobileMenuOpen((value) => !value)}
          aria-label={mobileMenuOpen ? "Close dashboard menu" : "Open dashboard menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="client-dashboard-mobile-menu"
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-md border border-stone-200 bg-white text-primary transition-colors hover:border-primary/30 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:hidden",
            !user?.isQaPreview && "ml-auto",
          )}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      <DashboardNavigationRow pathname={pathname} />
      <ClientDashboardMobileNav
        open={mobileMenuOpen}
        onClose={closeMobileMenu}
        triggerRef={mobileMenuButtonRef}
        language={language}
        onLanguageChange={setLanguage}
      />
    </header>
  );
}

function DashboardNavigationRow({ pathname }: { pathname: string }) {
  return (
    <div className="hidden bg-primary lg:block">
      <nav
        aria-label="Dashboard navigation"
        className={cn(
          DASHBOARD_HEADER_HORIZONTAL_CLASSNAME,
          "flex h-11 items-stretch gap-0.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {DASHBOARD_NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const isNewOrder = item.href === "/dashboard/orders/new";
          const itemClassName = cn(
            "group relative inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-dashboard-action font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white",
            isNewOrder
              ? cn(
                  "my-1 h-9 rounded-md bg-secondary text-primary hover:bg-secondary-light",
                  active && "ring-2 ring-inset ring-white/80",
                )
              : cn(
                  "h-full hover:bg-white/5 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-left after:bg-secondary after:transition-transform",
                  active
                    ? "text-white after:scale-x-100"
                    : "text-white/70 after:scale-x-0 hover:text-white hover:after:scale-x-100 focus-visible:after:scale-x-100",
                ),
          );

          return (
            <ClientPortalLink
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={itemClassName}
            >
              <item.icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
            </ClientPortalLink>
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
        className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-stone-200 bg-white text-primary transition-colors hover:border-primary/30 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-dashboard-action font-semibold text-foreground/80 transition-colors hover:bg-surface hover:text-primary focus:outline-none focus-visible:bg-surface focus-visible:text-primary"
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
        large ? "h-9 w-9 text-dashboard-metadata" : "h-7 w-7 text-xs"
      )}
      style={avatarUrl ? { backgroundImage: `url("${avatarUrl}")` } : undefined}
      aria-hidden
    >
      {!avatarUrl && initials}
    </span>
  );
}

export function DashboardAccountMenu({
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

    const top = rect.bottom + panelGap;
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
          "h-10 flex-shrink-0 gap-1.5 rounded-md border border-stone-200 bg-white px-1.5 pr-2 text-primary hover:border-primary/30 hover:bg-surface focus-visible:ring-primary focus-visible:ring-offset-2"
        )}
      >
        <DashboardAccountAvatar
          avatarUrl={user?.avatarUrl ?? null}
          initials={initials}
        />
        <span
          title={firstName}
          className={cn(
            "min-w-0 truncate font-semibold",
            "hidden max-w-24 text-dashboard-action sm:block"
          )}
        >
          {firstName}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 flex-shrink-0 transition-transform",
            "text-primary/60",
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
                  <p className="line-clamp-2 break-words text-dashboard-action font-bold text-foreground">
                    {displayName}
                  </p>
                  {user?.email && (
                    <p className="break-all text-dashboard-metadata text-muted">{user.email}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="py-1">
              {accountMenuItems.map((item) => (
                <ClientPortalLink
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpenPath(null)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-dashboard-action text-foreground/80 transition-colors hover:bg-surface hover:text-primary focus:outline-none focus-visible:bg-surface focus-visible:text-primary"
                >
                  <item.icon className="h-4 w-4 text-muted" aria-hidden />
                  {item.label}
                </ClientPortalLink>
              ))}
            </div>

            <div className="border-t border-border py-1">
              <SignOutButton
                label="Log Out"
                loadingLabel="Logging out..."
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-dashboard-action text-muted transition-colors hover:bg-surface hover:text-foreground focus:outline-none focus-visible:bg-surface focus-visible:text-foreground disabled:opacity-60"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
