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
// Both rows now share the same full-bleed container so the brand
// wordmark, top-level categories, and second-row service links
// all sit on the same left/right rail. The first row reads as
// the primary nav (text-[13px] uppercase tracking) and the
// second row as secondary (text-[12px] uppercase tracking).
// ============================================================

/**
 * Shared horizontal padding scale for both navigation rows. The
 * wordmark on row 1 and the first sub-link on row 2 use this so
 * they align on the same rail across all breakpoints.
 */
const NAV_X_PADDING = "px-4 sm:px-6 lg:px-8 xl:px-10";

export default function Header() {
  const pathname = usePathname() ?? "/";
  const active = getTopLevelForPath(pathname);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border">
      {/* ---------- Row 1: brand + top-level + CTAs ---------- */}
      <div className={NAV_X_PADDING}>
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link
            href="/"
            aria-label="PicchuSpot — Real Estate Visuals home"
            className="text-xl font-bold text-primary tracking-tight flex-shrink-0"
          >
            PicchuSpot
          </Link>

          {/* Top-level categories (desktop)
           *
           * Slightly larger and bolder than the second row so
           * primary navigation reads as primary. Active state is
           * a navy text + tinted background pill — clean and
           * obvious without competing visually.
           */}
          <nav
            aria-label="Service categories"
            className="hidden lg:flex items-center gap-1"
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
          <div className="hidden lg:flex items-center gap-2">
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

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 -mr-2"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* ---------- Row 2: desktop sub-nav with "More" overflow ----------
       *
       * The `key={active.key}` remount ensures all internal state
       * (overflow split, dropdown open/closed) resets when the user
       * switches top-level category, without any prop-driven setState
       * inside an effect.
       */}
      {active.subLinks.length > 0 && (
        <DesktopSubNav
          key={active.key}
          active={active}
          pathname={pathname}
        />
      )}

      {/* ---------- Mobile drawer ---------- */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-white">
          <div className="px-4 py-4 space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Top-level */}
            <div>
              <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted mb-2">
                Categories
              </p>
              <nav aria-label="Service categories" className="space-y-1">
                {topLevels.map((entry) => {
                  const isActive = entry.key === active.key;
                  return (
                    <Link
                      key={entry.key}
                      href={entry.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "block px-3 py-2 rounded-md text-[13px] font-bold uppercase tracking-[0.10em]",
                        isActive
                          ? "text-primary bg-primary/5"
                          : "text-foreground/85 hover:bg-surface"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {entry.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Sub-nav for active top-level */}
            {active.subLinks.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted mb-2">
                  {active.label}
                </p>
                <nav
                  aria-label={`${active.label} services`}
                  className="space-y-1"
                >
                  {active.subLinks.map((link) => (
                    <Link
                      key={link.label}
                      href={resolveSubLinkHref(link, active.href)}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-md text-[12px] font-bold uppercase tracking-[0.10em] text-foreground/70 hover:text-primary hover:bg-surface"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>
            )}

            {/* CTAs */}
            <div className="pt-2 border-t border-border space-y-2">
              {headerCtaLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "block px-3 py-2 rounded-md text-[13px] font-bold uppercase tracking-[0.10em]",
                    link.href === "/order"
                      ? "bg-primary text-white text-center"
                      : "text-foreground/85 hover:bg-surface"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Sub-nav links use `#anchor` to mean "scroll on the active
 * top-level page" and absolute paths to mean "navigate".
 */
function resolveSubLinkHref(link: SubNavLink, base: string): string {
  if (link.href.startsWith("#")) {
    return `${base === "/" ? "" : base}${link.href}`;
  }
  return link.href;
}

// ============================================================
// DESKTOP SUB-NAV WITH MEASUREMENT-BASED "MORE" OVERFLOW
//
// Two key fixes vs the previous iteration:
//
//  1. The dropdown's `absolute top-full` menu used to be clipped
//     by an `overflow-hidden` on the row container, so clicking
//     "More" appeared to open an empty popover. The fix is to
//     move `overflow-hidden` from the row container to the inner
//     <nav>, so visible items still get clipped during the brief
//     pre-measurement frame at SSR but the dropdown can extend
//     freely below the row.
//
//  2. Both navigation rows now share the same horizontal padding
//     rail (NAV_X_PADDING in this file) so the brand wordmark on
//     row 1 and the first sub-link on row 2 sit on the same
//     vertical line at every breakpoint. The measurement mirror
//     uses the same inset values so its child offsets line up
//     with the visible row.
// ============================================================

interface DesktopSubNavProps {
  active: TopLevelEntry;
  pathname: string;
}

function DesktopSubNav({ active, pathname }: DesktopSubNavProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureLayerRef = useRef<HTMLDivElement | null>(null);
  const measureMoreRef = useRef<HTMLSpanElement | null>(null);
  const moreWrapperRef = useRef<HTMLDivElement | null>(null);
  const [overflowAt, setOverflowAt] = useState(active.subLinks.length);
  const [moreOpen, setMoreOpen] = useState(false);

  // Measure how many sub-links fit in the visible row using a
  // hidden mirror that's laid out identically (same typography,
  // same gap, same inset). Two passes:
  //   1. Without reserving for the More button — if everything
  //      fits, no dropdown is needed.
  //   2. With the actual width of the rendered More button, since
  //      at least one item will spill into it.
  // Re-runs on container resize, on window resize, and once
  // document.fonts.ready resolves so labels resized after font
  // load get a corrected fit count.
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

      // Pass 1: assume everything fits. If it does, no dropdown.
      let allFit = 0;
      for (let i = 0; i < spans.length; i++) {
        const right = spans[i].offsetLeft + spans[i].offsetWidth;
        if (right > availableWidth) break;
        allFit = i + 1;
      }
      if (allFit === spans.length) {
        setOverflowAt(spans.length);
        return;
      }

      // Pass 2: reserve the actual More-button width plus a small
      // 16px breathing gap so the trailing visible link never
      // bumps up against the dropdown trigger.
      const moreWidth = measureMoreRef.current?.offsetWidth ?? 90;
      const allowed = availableWidth - moreWidth - 16;

      let count = 0;
      for (let i = 0; i < spans.length; i++) {
        const right = spans[i].offsetLeft + spans[i].offsetWidth;
        if (right > allowed) break;
        count = i + 1;
      }
      // Always keep at least one link visible — the row should
      // never collapse to "only More".
      setOverflowAt(Math.max(1, count));
    };

    measure();

    if (
      typeof document !== "undefined" &&
      typeof document.fonts !== "undefined"
    ) {
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

  // Close the More dropdown on outside pointer-down or Escape.
  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!moreWrapperRef.current?.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const visible = active.subLinks.slice(0, overflowAt);
  const overflow = active.subLinks.slice(overflowAt);

  return (
    <div className="hidden lg:block border-t border-border bg-white">
      <div className={cn("relative", NAV_X_PADDING)}>
        {/* Hidden measurement mirror — same typography and gap as
            the visible row, plus a real mirror of the More button
            so we reserve its actual width when trimming. */}
        <div
          ref={measureLayerRef}
          aria-hidden
          className="invisible pointer-events-none absolute inset-x-4 sm:inset-x-6 lg:inset-x-8 xl:inset-x-10 top-0 flex items-center gap-x-6 xl:gap-x-7 whitespace-nowrap py-3"
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

        {/* Visible row.
            NOTE: `overflow-hidden` lives on the inner <nav>, not
            on this container, so the More dropdown menu (which is
            absolutely positioned inside `moreWrapperRef`) can
            extend down past the row without being clipped. */}
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
            <div
              ref={moreWrapperRef}
              className="relative flex-shrink-0 flex items-stretch ml-3 xl:ml-4"
            >
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
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

              {moreOpen && (
                <div
                  role="menu"
                  aria-label={`${active.label} more services`}
                  className="absolute right-0 top-full mt-1 w-72 bg-white border border-border rounded-lg shadow-xl py-2 z-50"
                >
                  {overflow.map((link) => {
                    const href = resolveSubLinkHref(link, active.href);
                    const isCurrent =
                      !href.startsWith("#") && pathname === href;
                    return (
                      <Link
                        key={link.label}
                        href={href}
                        role="menuitem"
                        aria-current={isCurrent ? "page" : undefined}
                        onClick={() => setMoreOpen(false)}
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SubNavItemProps {
  href: string;
  label: string;
  current: boolean;
}

/**
 * Visible sub-nav link. Smaller than the top row to read as
 * secondary navigation. Uppercase, bold, with letter-spacing,
 * and a navy underline that slides in from the left on hover or
 * focus. Stays pinned for the current route.
 */
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
