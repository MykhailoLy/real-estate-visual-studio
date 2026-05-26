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
// Row 1: PicchuSpot wordmark + top-level service categories
//        (Remote Digital, Local Real Estate Media, Renders,
//        Online Retail) + Order/Contact CTAs.
// Row 2: Sub-nav for the active top-level. On desktop this row
//        renders only the links that fit, with overflow tucked
//        into a "More" dropdown so links never get clipped or
//        wrap onto a second line. On mobile the full menu lives
//        in the drawer below the row 1 hamburger.
// ============================================================

export default function Header() {
  const pathname = usePathname() ?? "/";
  const active = getTopLevelForPath(pathname);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border">
      {/* ---------- Row 1: brand + top-level + CTAs ---------- */}
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="flex items-center justify-between h-16">
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
            className="hidden lg:flex items-center gap-1"
          >
            {topLevels.map((entry) => {
              const isActive = entry.key === active.key;
              return (
                <Link
                  key={entry.key}
                  href={entry.href}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive
                      ? "text-primary bg-primary/5"
                      : "text-foreground/75 hover:text-primary hover:bg-surface"
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
                  "text-sm font-medium transition-colors",
                  link.href === "/order"
                    ? "bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-light"
                    : "text-foreground/75 hover:text-primary px-3 py-2"
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
       * switches top-level category, without any imperative reset
       * effects that would trip the "no setState in useEffect" rule.
       */}
      {active.subLinks.length > 0 && (
        <DesktopSubNav
          key={active.key}
          active={active}
          pathname={pathname}
        />
      )}

      {/* ---------- Mobile drawer ----------
       *
       * Mobile already lists every sub-link vertically inside the
       * drawer, so it doesn't need the desktop overflow handling.
       * The drawer renders the full sub-link list under the
       * matching top-level group. */}
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
                        "block px-3 py-2 rounded-md text-base font-medium",
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
                      className="block px-3 py-2 rounded-md text-sm text-foreground/70 hover:text-primary hover:bg-surface"
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
                    "block px-3 py-2 rounded-md text-base font-medium",
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
 * top-level page" and absolute paths to mean "navigate". The
 * desktop and mobile renderers share this resolver so behaviour
 * stays consistent across breakpoints.
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
// We measure each sub-link's natural width using a hidden mirror
// row, then render only the prefix that fits in the available
// container width. Anything that wouldn't fit ends up in a "More"
// dropdown anchored to the right of the row. The mirror layer is
// positioned absolutely with `inset-x-*` matching the parent's
// padding so its child offsets line up with the visible row.
//
// This component is remounted on category change (via `key` in
// the parent), which keeps the overflow split and dropdown state
// in lockstep with the active top-level without any prop-watcher
// effects.
// ============================================================

interface DesktopSubNavProps {
  active: TopLevelEntry;
  pathname: string;
}

/**
 * Approximate width reserved for the "More ▾" button + its
 * left margin, in CSS pixels. Slightly generous so we never let
 * the trailing visible link bump up against the More button.
 */
const MORE_BUTTON_RESERVE_PX = 110;

function DesktopSubNav({ active, pathname }: DesktopSubNavProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureLayerRef = useRef<HTMLDivElement | null>(null);
  const moreWrapperRef = useRef<HTMLDivElement | null>(null);
  const [overflowAt, setOverflowAt] = useState(active.subLinks.length);
  const [moreOpen, setMoreOpen] = useState(false);

  // Measure how many sub-links fit in the visible row. Re-runs on
  // mount and any time the container resizes.
  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const layer = measureLayerRef.current;
      if (!container || !layer) return;

      const availableWidth = container.offsetWidth;
      const spans = Array.from(layer.children) as HTMLElement[];
      if (spans.length === 0) return;

      // Pass 1: how many fit if we don't reserve any room for "More"?
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

      // Pass 2: at least one will spill into "More", so reserve the
      // button's width when deciding which links can stay visible.
      const allowed = availableWidth - MORE_BUTTON_RESERVE_PX;
      let count = 0;
      for (let i = 0; i < spans.length; i++) {
        const right = spans[i].offsetLeft + spans[i].offsetWidth;
        if (right > allowed) break;
        count = i + 1;
      }
      // Always keep at least one link visible — an empty row with
      // only "More" looks broken even if the available width is
      // narrower than the first link itself.
      setOverflowAt(Math.max(1, count));
    };

    measure();
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
      <div className="relative max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
        {/* Hidden measurement mirror — same typography + gap as the
            visible row so its children's `offsetLeft + offsetWidth`
            tells us exactly where the visible row would clip. */}
        <div
          ref={measureLayerRef}
          aria-hidden
          className="invisible pointer-events-none absolute inset-x-4 sm:inset-x-6 lg:inset-x-12 top-0 flex items-center gap-x-7 xl:gap-x-9 whitespace-nowrap py-3.5"
        >
          {active.subLinks.map((link) => (
            <span
              key={`measure-${link.label}`}
              className="text-[13px] font-bold uppercase tracking-[0.10em]"
            >
              {link.label}
            </span>
          ))}
        </div>

        {/* Visible row */}
        <div
          ref={containerRef}
          className="flex items-stretch overflow-hidden"
        >
          <nav
            aria-label={`${active.label} services`}
            className="flex items-stretch gap-x-7 xl:gap-x-9 flex-1 min-w-0"
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
                  "group relative inline-flex items-center gap-1.5 py-3.5 text-[13px] font-bold uppercase tracking-[0.10em] whitespace-nowrap transition-colors focus:outline-none focus-visible:text-primary",
                  moreOpen ? "text-primary" : "text-foreground/65 hover:text-primary"
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
 * Single visible sub-nav link. Renders the label in uppercase
 * with extra letter-spacing, plus an animated underline that
 * slides in from the left on hover/focus and stays put when the
 * route is the current page.
 */
function SubNavItem({ href, label, current }: SubNavItemProps) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "group relative inline-flex items-center py-3.5 text-[13px] font-bold uppercase tracking-[0.10em] whitespace-nowrap transition-colors focus:outline-none focus-visible:text-primary",
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
