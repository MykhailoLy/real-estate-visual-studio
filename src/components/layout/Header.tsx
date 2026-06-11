"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  ChevronDown,
  FileText,
  Globe2,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Mail,
  Menu,
  Newspaper,
  Tags,
  X,
} from "lucide-react";
import { RegionCurrencySelector } from "@/components/pricing/currency-client";
import {
  trackContactIntentClick,
  trackLanguageSwitch,
  trackLoginClick,
  trackSignUpClick,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";
import {
  getTopLevelForPath,
  topLevels,
  type SubNavLink,
  type TopLevelEntry,
} from "@/lib/nav";

// ============================================================
// HEADER — TWO-LEVEL NAVIGATION
//
// Row 1: brand wordmark + top-level category links + CTAs
// Row 2: service sub-links for the active top-level, with a
//         measurement-based "More" overflow dropdown
//
// Key fixes in this revision:
//
//   1. More dropdown — fixed-position overlay
//      The sub-nav row is inside a sticky header that has
//      overflow-x-hidden applied globally. `absolute top-full`
//      on the dropdown was being clipped by that or any ancestor
//      overflow context. Solution: measure the trigger button's
//      screen rect with getBoundingClientRect() and render the
//      dropdown with `position: fixed` at those coordinates.
//      This escapes every overflow context.
//
//   2. Mobile drawer — accordion sections
//      Each top-level category becomes an expandable accordion
//      section with a chevron arrow on the right. Tapping the
//      row header (or its arrow) toggles the sub-links. Clicking
//      any sub-link closes the entire mobile menu.
// ============================================================

const NAV_X_PADDING = "px-4 sm:px-6 lg:px-8 xl:px-10";

type SiteLanguage = "en" | "es";

const LANGUAGE_STORAGE_KEY = "picchuspot-language";
const LANGUAGE_COOKIE_NAME = "picchuspot_language";

const ENGLISH_TO_SPANISH_ROUTES: Record<string, string> = {
  "/": "/es",
  "/services": "/es/services",
  "/pricing": "/es/pricing",
  "/contact": "/es/contact",
};

const SPANISH_TO_ENGLISH_ROUTES: Record<string, string> = {
  "/es": "/",
  "/es/services": "/services",
  "/es/pricing": "/pricing",
  "/es/contact": "/contact",
};

type ResourceMenuItem = {
  label: string;
  description: string;
  href?: string;
  localizedHref?: string;
  icon: typeof Info;
  status?: "coming-soon";
};

const resourceMenuItems: ResourceMenuItem[] = [
  {
    label: "About",
    description: "Who PicchuSpot is and how we work.",
    href: "/about",
    icon: Info,
  },
  {
    label: "Contact Us",
    description: "Quotes, local work, and order support.",
    href: "/contact",
    localizedHref: "/es/contact",
    icon: Mail,
  },
  {
    label: "Pricing",
    description: "Transparent rates for core visual services.",
    href: "/pricing",
    localizedHref: "/es/pricing",
    icon: Tags,
  },
  {
    label: "Gallery",
    description: "Before-and-after examples and selected work.",
    icon: ImageIcon,
    status: "coming-soon",
  },
  {
    label: "Resources",
    description: "Guides and practical property marketing notes.",
    icon: BookOpen,
    status: "coming-soon",
  },
  {
    label: "FAQ",
    description: "Common questions about services and delivery.",
    href: "/faq",
    icon: HelpCircle,
  },
  {
    label: "Blog",
    description: "Articles and market notes.",
    icon: Newspaper,
    status: "coming-soon",
  },
  {
    label: "Press Kit",
    description: "Brand assets and media information.",
    icon: FileText,
    status: "coming-soon",
  },
];

function normalizeLanguagePath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

function isSiteLanguage(value: unknown): value is SiteLanguage {
  return value === "en" || value === "es";
}

function getPathLanguage(pathname: string): SiteLanguage | null {
  const normalized = normalizeLanguagePath(pathname);
  return normalized === "/es" || normalized.startsWith("/es/") ? "es" : null;
}

function readCookieLanguage(): SiteLanguage | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${LANGUAGE_COOKIE_NAME}=`));
  if (!cookie) return null;
  const value = decodeURIComponent(cookie.split("=").slice(1).join("="));
  return isSiteLanguage(value) ? value : null;
}

function readStoredLanguage(): SiteLanguage | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSiteLanguage(stored)) return stored;
  } catch {
    // Ignore unavailable storage.
  }
  return readCookieLanguage();
}

function writeLanguagePreference(language: SiteLanguage) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore unavailable storage.
  }
  document.cookie = `${LANGUAGE_COOKIE_NAME}=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function getCurrentLanguage(
  pathname: string,
  savedLanguage: SiteLanguage | null
): SiteLanguage {
  return getPathLanguage(pathname) ?? savedLanguage ?? "en";
}

function getLanguageHref(pathname: string, language: SiteLanguage): string {
  const normalized = normalizeLanguagePath(pathname);
  if (language === "es") {
    return ENGLISH_TO_SPANISH_ROUTES[normalized] ?? "/es";
  }
  return SPANISH_TO_ENGLISH_ROUTES[normalized] ?? "/";
}

function getLocaleAwareHref(href: string, language: SiteLanguage): string {
  if (language === "es") {
    return ENGLISH_TO_SPANISH_ROUTES[href] ?? href;
  }
  return SPANISH_TO_ENGLISH_ROUTES[href] ?? href;
}

export default function Header() {
  const pathname = usePathname() ?? "/";
  const [savedLanguage, setSavedLanguage] = useState<SiteLanguage | null>(null);
  const currentLanguage = getCurrentLanguage(pathname, savedLanguage);
  const active = getTopLevelForPath(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    window.queueMicrotask(() => setSavedLanguage(readStoredLanguage()));
  }, []);

  const setLanguagePreference = (language: SiteLanguage) => {
    writeLanguagePreference(language);
    setSavedLanguage(language);
    trackLanguageSwitch(language, "header");
  };

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const insidePanel = menuPanelRef.current?.contains(target) ?? false;
      const insideButton = menuButtonRef.current?.contains(target) ?? false;
      if (!insidePanel && !insideButton) {
        closeMenu();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border w-full overflow-x-hidden">
      {/* ── Row 1: brand + top-level + CTAs ── */}
      <div className={NAV_X_PADDING}>
        <div className="flex items-center h-16">
          {/* Brand */}
          <Link
            href={getLocaleAwareHref("/", currentLanguage)}
            aria-label="PicchuSpot — Real Estate Visuals home"
            className="text-xl font-bold text-primary tracking-tight flex-shrink-0"
          >
            PicchuSpot
          </Link>

          {/* Top-level categories (desktop) */}
          <nav
            aria-label="Service categories"
            className="hidden lg:flex items-center gap-1 ml-8 xl:ml-12"
          >
            {topLevels.map((entry) => {
              const isActive = entry.key === active.key;
              return (
                <Link
                  key={entry.key}
                  href={getLocaleAwareHref(entry.href, currentLanguage)}
                  className={cn(
                    "px-3 py-2 text-[13px] font-bold uppercase tracking-[0.10em] rounded-md transition-colors",
                    isActive
                      ? "text-primary bg-primary/5"
                      : "text-foreground/70 hover:text-primary hover:bg-surface"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {entry.label}
                </Link>
              );
            })}
          </nav>

          {/* Menu, account actions, and preferences */}
          <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
            <button
              ref={menuButtonRef}
              className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-stone-200 bg-white text-primary shadow-sm transition-colors hover:border-primary/30 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-10 sm:w-10"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link
              href="/login"
              onClick={() => trackLoginClick("header")}
              className="inline-flex h-9 flex-shrink-0 items-center justify-center rounded-md px-3 text-xs font-bold uppercase tracking-[0.10em] text-primary transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-auto sm:py-2 sm:text-[13px] sm:text-foreground/70 sm:hover:text-primary"
              aria-label="Login"
            >
              Login
            </Link>
            <Link
              href="/signup"
              onClick={() => trackSignUpClick("header")}
              className="hidden h-9 flex-shrink-0 items-center justify-center rounded-md bg-primary px-4 text-[13px] font-bold uppercase tracking-[0.10em] text-white shadow-sm transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:inline-flex"
              aria-label="Sign Up"
            >
              Sign Up
            </Link>
            <LanguageSelector
              pathname={pathname}
              currentLanguage={currentLanguage}
              compact
              className="hidden lg:inline-flex"
              onLanguageChange={setLanguagePreference}
            />
            <RegionCurrencySelector
              compact
              tight
              className="hidden lg:inline-flex"
              analyticsLocation="header"
            />
          </div>
        </div>
      </div>

      {/* ── Row 2: desktop sub-nav ── */}
      {active.subLinks.length > 0 && (
        <DesktopSubNav
          key={active.key}
          active={active}
          pathname={pathname}
          language={currentLanguage}
        />
      )}

      {/* ── Mobile drawer ── */}
      {menuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <BurgerMenuPanel
            panelRef={menuPanelRef}
            language={currentLanguage}
            pathname={pathname}
            onLanguageChange={setLanguagePreference}
            onClose={closeMenu}
          />,
          document.body
        )}
    </header>
  );
}

// ============================================================
// HELPERS
// ============================================================

function resolveSubLinkHref(
  link: SubNavLink,
  base: string,
  language: SiteLanguage
): string {
  if (link.href.startsWith("#")) {
    const localizedBase = getLocaleAwareHref(base, language);
    return `${localizedBase === "/" ? "" : localizedBase}${link.href}`;
  }
  return getLocaleAwareHref(link.href, language);
}

// ============================================================
// MOBILE DRAWER — accordion sections
// ============================================================

interface MobileDrawerProps {
  active: TopLevelEntry;
  pathname: string;
  language: SiteLanguage;
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MobileDrawer({
  active,
  pathname,
  language,
  openKey,
  setOpenKey,
  onClose,
}: MobileDrawerProps) {
  const toggleSection = (key: string) => {
    setOpenKey(openKey === key ? null : key);
  };

  return (
    <div className="lg:hidden border-t border-border bg-white">
      <div className="px-4 py-3 max-h-[80vh] overflow-y-auto">
        {/* Accordion sections — one per top-level category */}
        <div className="space-y-1 mb-4">
          {topLevels.map((entry) => {
            const isExpanded = openKey === entry.key;
            const isActive = entry.key === active.key;

            return (
              <div key={entry.key} className="rounded-lg overflow-hidden">
                {/* Section header — tap to toggle */}
                <button
                  type="button"
                  onClick={() => toggleSection(entry.key)}
                  aria-expanded={isExpanded}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-3 rounded-lg text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isActive
                      ? "bg-primary/5 text-primary"
                      : "text-foreground/80 hover:bg-surface"
                  )}
                >
                  <span className="text-[13px] font-bold uppercase tracking-[0.10em]">
                    {entry.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 flex-shrink-0 text-muted transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )}
                    aria-hidden
                  />
                </button>

                {/* Sub-links — shown when section is expanded */}
                {isExpanded && (
                  <div className="pl-3 pb-2 space-y-0.5">
                    {entry.subLinks.length > 0 ? (
                      entry.subLinks.map((link) => {
                        const href = resolveSubLinkHref(
                          link,
                          entry.href,
                          language
                        );
                        const isCurrent =
                          !href.startsWith("#") && pathname === href;
                        return (
                          <Link
                            key={link.label}
                            href={href}
                            onClick={onClose}
                            className={cn(
                              "block px-3 py-2 rounded-md text-[12px] font-semibold tracking-[0.06em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                              isCurrent
                                ? "text-primary bg-primary/5"
                                : "text-foreground/65 hover:text-primary hover:bg-surface"
                            )}
                            aria-current={isCurrent ? "page" : undefined}
                          >
                            {link.label}
                          </Link>
                        );
                      })
                    ) : (
                      // No sub-links yet — link to the top-level page directly
                      <Link
                        href={getLocaleAwareHref(entry.href, language)}
                        onClick={onClose}
                        className="block px-3 py-2 rounded-md text-[12px] font-semibold tracking-[0.06em] text-foreground/65 hover:text-primary hover:bg-surface"
                      >
                        {entry.label}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

interface BurgerMenuPanelProps {
  panelRef: React.RefObject<HTMLDivElement | null>;
  language: SiteLanguage;
  pathname: string;
  onLanguageChange: (language: SiteLanguage) => void;
  onClose: () => void;
}

function getResourceHref(item: ResourceMenuItem, language: SiteLanguage) {
  if (item.status === "coming-soon") return null;
  if (language === "es" && item.localizedHref) return item.localizedHref;
  return item.href ?? null;
}

function BurgerMenuPanel({
  panelRef,
  language,
  pathname,
  onLanguageChange,
  onClose,
}: BurgerMenuPanelProps) {
  return (
    <div
      className="fixed inset-0 z-[10000] bg-primary/10 backdrop-blur-[2px] px-3 py-4 sm:px-6"
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        className="ml-auto mt-14 flex max-h-[calc(100vh-5.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary-dark">
              PicchuSpot
            </p>
            <h2 className="text-lg font-bold text-primary">Menu</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-200 text-primary transition-colors hover:border-primary/30 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          <section className="mb-5 rounded-xl border border-stone-200 bg-surface/60 p-4 lg:hidden">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
              Preferences
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-secondary-dark">
                  Language
                </p>
                <LanguageSelector
                  pathname={pathname}
                  currentLanguage={language}
                  className="w-full"
                  onNavigate={onClose}
                  onLanguageChange={onLanguageChange}
                />
              </div>
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-secondary-dark">
                  Region
                </p>
                <RegionCurrencySelector
                  className="w-full"
                  analyticsLocation="mobile_menu"
                />
              </div>
            </div>
          </section>

          <section>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
              Explore
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {resourceMenuItems.map((item) => (
                <ResourceMenuLink
                  key={item.label}
                  item={item}
                  href={getResourceHref(item, language)}
                  onClose={onClose}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ResourceMenuLink({
  item,
  href,
  onClose,
}: {
  item: ResourceMenuItem;
  href: string | null;
  onClose: () => void;
}) {
  const Icon = item.icon;
  const content = (
    <>
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface text-secondary-dark">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-primary">{item.label}</span>
          {item.status === "coming-soon" && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
              Coming soon
            </span>
          )}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted">
          {item.description}
        </span>
      </span>
    </>
  );

  if (!href) {
    return (
      <div className="flex cursor-not-allowed gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 opacity-80">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={() => {
        if (href === "/contact" || href === "/es/contact") {
          trackContactIntentClick("header");
        }
        onClose();
      }}
      className="flex gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 transition-colors hover:border-primary/30 hover:bg-surface"
    >
      {content}
    </Link>
  );
}

function LanguageSelector({
  pathname,
  currentLanguage,
  compact = false,
  className,
  onNavigate,
  onLanguageChange,
}: {
  pathname: string;
  currentLanguage: SiteLanguage;
  compact?: boolean;
  className?: string;
  onNavigate?: () => void;
  onLanguageChange: (language: SiteLanguage) => void;
}) {
  const options: { code: SiteLanguage; label: string }[] = [
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
  ];

  return (
    <nav
      aria-label="Select language"
      className={cn(
        "inline-flex items-center rounded-lg border border-stone-200 bg-white/95 p-0.5 shadow-sm",
        compact && "h-9 flex-shrink-0",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex items-center px-2 text-primary",
          compact && "hidden lg:inline-flex"
        )}
      >
        <Globe2 className="h-4 w-4" aria-hidden />
      </span>
      {options.map((option) => {
        const active = option.code === currentLanguage;
        return (
          <Link
            key={option.code}
            href={getLanguageHref(pathname, option.code)}
            onClick={() => {
              onLanguageChange(option.code);
              onNavigate?.();
            }}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex flex-1 items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors",
              compact && "min-w-7 px-2",
              active
                ? "bg-primary text-white"
                : "text-foreground/70 hover:bg-surface hover:text-primary"
            )}
          >
            {compact
              ? option.code.toUpperCase()
              : option.code === "es"
                ? "Español"
                : option.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ============================================================
// DESKTOP SUB-NAV WITH MEASUREMENT-BASED "MORE" OVERFLOW
//
// The More dropdown is rendered with position:fixed at the
// screen coordinates of the trigger button so it escapes every
// overflow context (including the sticky header's
// overflow-x-hidden and any parent clipping).
// ============================================================

interface DesktopSubNavProps {
  active: TopLevelEntry;
  pathname: string;
  language: SiteLanguage;
}

function DesktopSubNav({ active, pathname, language }: DesktopSubNavProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureLayerRef = useRef<HTMLDivElement | null>(null);
  const measureMoreRef = useRef<HTMLSpanElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  // Ref forwarded into MoreDropdown so the outside-click handler
  // can check both the trigger button AND the panel itself before
  // deciding to close. Without this a pointerdown on a menu item
  // would close the dropdown before the Link's click/navigation
  // had a chance to complete.
  const dropdownPanelRef = useRef<HTMLDivElement | null>(null);
  const [overflowAt, setOverflowAt] = useState(active.subLinks.length);
  const [moreOpen, setMoreOpen] = useState(false);
  // Screen coords for the fixed dropdown
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

  // Measure which sub-links fit in the visible row.
  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const layer = measureLayerRef.current;
      if (!container || !layer) return;

      const availableWidth = container.offsetWidth;
      const spans = Array.from(layer.children).filter(
        (el): el is HTMLElement =>
          el instanceof HTMLElement && el.dataset.subnavMeasure === "link"
      );
      if (spans.length === 0) return;

      // Pass 1: does everything fit?
      let allFit = 0;
      for (let i = 0; i < spans.length; i++) {
        if (spans[i].offsetLeft + spans[i].offsetWidth > availableWidth) break;
        allFit = i + 1;
      }
      if (allFit === spans.length) {
        setOverflowAt(spans.length);
        return;
      }

      // Pass 2: reserve More-button width
      const moreWidth = measureMoreRef.current?.offsetWidth ?? 90;
      const allowed = availableWidth - moreWidth - 16;
      let count = 0;
      for (let i = 0; i < spans.length; i++) {
        if (spans[i].offsetLeft + spans[i].offsetWidth > allowed) break;
        count = i + 1;
      }
      setOverflowAt(Math.max(1, count));
    };

    measure();
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Open dropdown and capture the trigger button's position
  const openMore = () => {
    if (!moreButtonRef.current) return;
    const rect = moreButtonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 4,   // 4 px gap below the button
      right: window.innerWidth - rect.right,
    });
    setMoreOpen(true);
  };

  const closeMore = () => setMoreOpen(false);

  // Close on outside click or Escape
  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      // Close only when the click is outside BOTH the trigger button
      // and the dropdown panel. This prevents the pointerdown from
      // closing the menu before a Link inside the panel has time to
      // fire its click / navigation event.
      const target = e.target as Node;
      const insideButton = moreButtonRef.current?.contains(target) ?? false;
      const insidePanel = dropdownPanelRef.current?.contains(target) ?? false;
      if (!insideButton && !insidePanel) {
        closeMore();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMore();
    };
    // Re-position on scroll so the dropdown follows the button if
    // the page scrolls (though with sticky header this is minimal)
    const onScroll = () => {
      if (moreButtonRef.current) {
        const rect = moreButtonRef.current.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
        });
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [moreOpen]);

  const visible = active.subLinks.slice(0, overflowAt);
  const overflow = active.subLinks.slice(overflowAt);

  return (
    <div className="hidden lg:block border-t border-border bg-white">
      <div className={cn("relative", NAV_X_PADDING)}>
        {/* Hidden measurement mirror */}
        <div
          ref={measureLayerRef}
          aria-hidden
          className="invisible pointer-events-none absolute inset-x-4 sm:inset-x-6 lg:inset-x-8 xl:inset-x-10 top-0 flex items-center gap-x-6 xl:gap-x-7 whitespace-nowrap py-3 overflow-hidden"
        >
          {active.subLinks.map((link) => (
            <span
              key={`measure-${link.label}`}
              data-subnav-measure="link"
              className="text-[12px] font-bold uppercase tracking-[0.10em]"
            >
              {link.label}
            </span>
          ))}
          <span
            ref={measureMoreRef}
            data-subnav-measure="more"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.10em]"
          >
            More
            <ChevronDown className="w-3.5 h-3.5" aria-hidden />
          </span>
        </div>

        {/* Visible row */}
        <div ref={containerRef} className="flex items-stretch">
          <nav
            aria-label={`${active.label} services`}
            className="flex items-stretch gap-x-6 xl:gap-x-7 flex-1 min-w-0 overflow-hidden"
          >
            {visible.map((link) => {
              const href = resolveSubLinkHref(link, active.href, language);
              const isCurrent = !href.startsWith("#") && pathname === href;
              return (
                <SubNavItem
                  key={link.label}
                  href={href}
                  label={link.label}
                  current={isCurrent}
                />
              );
            })}
          </nav>

          {overflow.length > 0 && (
            <div className="relative flex-shrink-0 flex items-stretch ml-3 xl:ml-4">
              <button
                ref={moreButtonRef}
                type="button"
                onClick={() => (moreOpen ? closeMore() : openMore())}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={cn(
                  "group relative inline-flex items-center gap-1.5 py-3 text-[12px] font-bold uppercase tracking-[0.10em] whitespace-nowrap transition-colors focus:outline-none focus-visible:text-primary",
                  moreOpen
                    ? "text-primary"
                    : "text-foreground/65 hover:text-primary"
                )}
              >
                More
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform duration-200",
                    moreOpen && "rotate-180"
                  )}
                  aria-hidden
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 right-0 bottom-0 h-[2px] bg-primary origin-left transition-transform duration-200",
                    moreOpen
                      ? "scale-x-100"
                      : "scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100"
                  )}
                />
              </button>

              {/* Dropdown — fixed position so it escapes every
                  overflow / stacking context in the sticky header */}
              {moreOpen && dropdownPos && (
                <MoreDropdown
                  links={overflow}
                  active={active}
                  pathname={pathname}
                  language={language}
                  top={dropdownPos.top}
                  right={dropdownPos.right}
                  onClose={closeMore}
                  panelRef={dropdownPanelRef}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── More dropdown rendered at fixed screen coordinates ────────

interface MoreDropdownProps {
  links: SubNavLink[];
  active: TopLevelEntry;
  pathname: string;
  language: SiteLanguage;
  top: number;
  right: number;
  onClose: () => void;
  /** Forwarded ref attached to the panel div so the outside-click
   *  handler in DesktopSubNav can test containment before closing. */
  panelRef: React.RefObject<HTMLDivElement | null>;
}

function MoreDropdown({
  links,
  active,
  pathname,
  language,
  top,
  right,
  onClose,
  panelRef,
}: MoreDropdownProps) {
  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={`${active.label} more services`}
      style={{
        position: "fixed",
        top,
        right,
        width: "18rem",   // w-72
        zIndex: 9999,
      }}
      className="bg-white border border-border rounded-lg shadow-xl py-2"
    >
      {links.map((link) => {
        const href = resolveSubLinkHref(link, active.href, language);
        const isCurrent = !href.startsWith("#") && pathname === href;
        return (
          <Link
            key={link.label}
            href={href}
            role="menuitem"
            aria-current={isCurrent ? "page" : undefined}
            onClick={onClose}
            className={cn(
              "block px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.10em] transition-colors focus:outline-none focus-visible:bg-surface",
              isCurrent
                ? "text-primary bg-primary/5"
                : "text-foreground/75 hover:text-primary hover:bg-surface"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

// ── Sub-nav visible link ──────────────────────────────────────

interface SubNavItemProps {
  href: string;
  label: string;
  current: boolean;
}

function SubNavItem({ href, label, current }: SubNavItemProps) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "group relative inline-flex items-center py-3 text-[12px] font-bold uppercase tracking-[0.10em] whitespace-nowrap transition-colors focus:outline-none focus-visible:text-primary",
        current ? "text-primary" : "text-foreground/65 hover:text-primary"
      )}
    >
      {label}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 right-0 bottom-0 h-[2px] bg-primary origin-left transition-transform duration-200",
          current
            ? "scale-x-100"
            : "scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100"
        )}
      />
    </Link>
  );
}
