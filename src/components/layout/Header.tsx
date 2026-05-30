"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getTopLevelForPath,
  headerCtaLinks,
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

export default function Header() {
  const pathname = usePathname() ?? "/";
  const active = getTopLevelForPath(pathname);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Which top-level accordion is expanded in the mobile drawer.
  // Initialised to the active category so the current section's
  // links are immediately visible on open.
  const [mobileOpenKey, setMobileOpenKey] = useState<string | null>(
    active.key
  );

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border w-full overflow-x-hidden">
      {/* ── Row 1: brand + top-level + CTAs ── */}
      <div className={NAV_X_PADDING}>
        <div className="flex items-center h-16">
          {/* Brand */}
          <Link
            href="/"
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
                  href={entry.href}
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

          {/* Right-side CTAs (desktop) */}
          <div className="hidden lg:flex items-center gap-2 ml-auto">
            {headerCtaLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-[13px] font-bold uppercase tracking-[0.10em] transition-colors",
                  link.href === "/order"
                    ? "bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-light"
                    : "text-foreground/70 hover:text-primary px-3 py-2"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="lg:hidden ml-auto p-2 -mr-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            onClick={() => {
              const nextOpen = !mobileMenuOpen;
              setMobileMenuOpen(nextOpen);
              // When opening, reset the expanded accordion to the
              // currently active top-level so the user always sees
              // their current section's links immediately on open.
              if (nextOpen) {
                setMobileOpenKey(active.key);
              }
            }}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* ── Row 2: desktop sub-nav ── */}
      {active.subLinks.length > 0 && (
        <DesktopSubNav
          key={active.key}
          active={active}
          pathname={pathname}
        />
      )}

      {/* ── Mobile drawer ── */}
      {mobileMenuOpen && (
        <MobileDrawer
          active={active}
          pathname={pathname}
          openKey={mobileOpenKey}
          setOpenKey={setMobileOpenKey}
          onClose={closeMobileMenu}
        />
      )}
    </header>
  );
}

// ============================================================
// HELPERS
// ============================================================

function resolveSubLinkHref(link: SubNavLink, base: string): string {
  if (link.href.startsWith("#")) {
    return `${base === "/" ? "" : base}${link.href}`;
  }
  return link.href;
}

// ============================================================
// MOBILE DRAWER — accordion sections
// ============================================================

interface MobileDrawerProps {
  active: TopLevelEntry;
  pathname: string;
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
  onClose: () => void;
}

function MobileDrawer({
  active,
  pathname,
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
                        const href = resolveSubLinkHref(link, entry.href);
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
                        href={entry.href}
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

        {/* Separator */}
        <div className="border-t border-border pt-3 space-y-1">
          {headerCtaLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className={cn(
                "block px-3 py-3 rounded-lg text-[13px] font-bold uppercase tracking-[0.10em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                link.href === "/order"
                  ? "bg-primary text-white text-center mt-2"
                  : "text-foreground/80 hover:bg-surface"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
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
}

function DesktopSubNav({ active, pathname }: DesktopSubNavProps) {
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
              const href = resolveSubLinkHref(link, active.href);
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
        const href = resolveSubLinkHref(link, active.href);
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
