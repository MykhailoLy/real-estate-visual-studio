"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getTopLevelForPath,
  headerCtaLinks,
  topLevels,
} from "@/lib/nav";

// ============================================================
// HEADER — TWO-LEVEL NAVIGATION
//
// Row 1: PicchuSpot wordmark + top-level service categories
//        (Remote Digital, Local Real Estate Media, Renders,
//        Online Retail) + Order/Contact CTAs.
// Row 2: Sub-nav for the active top-level (e.g. on /, the row
//        shows the ten remote services as anchor links). Hidden
//        on routes that don't map to a top-level — currently we
//        always map to "remote" as the default.
//
// The full menu collapses into a single drawer on mobile.
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

      {/* ---------- Row 2: sub-nav for the active top-level ----------
       *
       * Compact and clean: white background (not a tinted band), a
       * single hairline border above for separation, and a single
       * scrollable row so links never wrap into a second line and
       * never sit inside visible "boxes". The custom-scrollbar
       * styles hide the default scrollbar on the rare wide list. */}
      {active.subLinks.length > 0 && (
        <div className="hidden lg:block border-t border-border bg-white">
          <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
            <nav
              aria-label={`${active.label} services`}
              className="flex items-center gap-x-7 xl:gap-x-9 py-3 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {active.subLinks.map((link) => (
                <Link
                  key={link.href}
                  href={
                    link.href.startsWith("#")
                      ? `${active.href === "/" ? "" : active.href}${link.href}`
                      : link.href
                  }
                  className="text-[13px] font-medium text-foreground/65 hover:text-primary transition-colors whitespace-nowrap"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
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
                      key={link.href}
                      href={
                        link.href.startsWith("#")
                          ? `${active.href === "/" ? "" : active.href}${link.href}`
                          : link.href
                      }
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
