"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Briefcase,
  Building2,
  ChevronDown,
  ImagePlus,
  LayoutDashboard,
  Menu,
  PictureInPicture2,
  RotateCcw,
  X,
} from "lucide-react";
import { PicchuSpotLogo, BrandWordmark } from "@/components/brand";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";

const adminNav = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    description: "Workspace overview",
  },
  {
    label: "Orders",
    href: "/admin/orders",
    icon: Briefcase,
    description: "Customer orders and files",
  },
  {
    label: "Properties",
    href: "/admin/properties",
    icon: Building2,
    description: "Property showcase pages",
  },
  {
    label: "Portfolio",
    href: "/admin/portfolio",
    icon: ImagePlus,
    description: "Public before/after work",
  },
  {
    label: "Media",
    href: "/admin/media",
    icon: PictureInPicture2,
    description: "Site visuals and assets",
  },
  {
    label: "Rework",
    href: "/admin/rework",
    icon: RotateCcw,
    description: "Revision queue",
  },
];

function activeFor(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function pageLabel(pathname: string): string {
  if (pathname === "/admin") return "Overview";
  if (pathname.startsWith("/admin/orders/")) return "Order Detail";
  const item = adminNav.find((nav) => activeFor(pathname, nav.href));
  return item?.label ?? "Workspace";
}

function sectionHref(pathname: string): string {
  if (pathname.startsWith("/admin/orders/")) return "/admin/orders";
  const item = adminNav.find((nav) => activeFor(pathname, nav.href));
  return item?.href ?? "/admin";
}

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenu, setMobileMenu] = useState({
    open: false,
    pathname,
  });
  const mobileOpen = mobileMenu.open && mobileMenu.pathname === pathname;

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const currentLabel = pageLabel(pathname);
  const currentHref = sectionHref(pathname);

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-10">
          <div className="flex min-h-16 items-center justify-between gap-4">
            <Link
              href="/admin"
              className="group flex min-w-0 items-center gap-3"
              aria-label="PicchuSpot admin dashboard"
            >
              <PicchuSpotLogo
                variant="mark"
                className="h-8 w-auto flex-shrink-0"
                width={64}
                height={32}
                alt=""
              />
              <span className="min-w-0">
                <BrandWordmark theme="light" className="block text-sm" />
                <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-secondary-dark">
                  Admin workspace
                </span>
              </span>
            </Link>

            <nav
              aria-label="Admin navigation"
              className="hidden lg:flex items-center gap-1"
            >
              {adminNav.map((item) => {
                const active = activeFor(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition-colors ${
                      active
                        ? "bg-primary text-white shadow-sm"
                        : "text-foreground/70 hover:bg-surface hover:text-primary"
                    }`}
                  >
                    <item.icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="hidden lg:block">
              <AdminLogoutButton />
            </div>

            <div className="relative lg:hidden">
              <button
                type="button"
                onClick={() =>
                  setMobileMenu({
                    open: !mobileOpen,
                    pathname,
                  })
                }
                aria-expanded={mobileOpen}
                aria-controls="admin-mobile-menu"
                className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-bold text-primary shadow-sm"
              >
                {mobileOpen ? (
                  <X className="h-4 w-4" aria-hidden />
                ) : (
                  <Menu className="h-4 w-4" aria-hidden />
                )}
                Menu
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    mobileOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </button>
              {mobileOpen && (
                <div
                  id="admin-mobile-menu"
                  className="absolute right-0 mt-3 w-[min(88vw,340px)] rounded-2xl border border-border bg-white p-3 shadow-xl"
                >
                  <div className="space-y-1">
                    {adminNav.map((item) => {
                      const active = activeFor(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() =>
                            setMobileMenu({ open: false, pathname })
                          }
                          aria-current={active ? "page" : undefined}
                          className={`flex items-start gap-3 rounded-xl px-3 py-3 transition-colors ${
                            active
                              ? "bg-primary text-white"
                              : "text-foreground hover:bg-surface"
                          }`}
                        >
                          <item.icon
                            className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                              active ? "text-white" : "text-secondary-dark"
                            }`}
                            aria-hidden
                          />
                          <span>
                            <span className="block text-sm font-bold">
                              {item.label}
                            </span>
                            <span
                              className={`block text-xs leading-relaxed ${
                                active ? "text-white/70" : "text-muted"
                              }`}
                            >
                              {item.description}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                  <div className="mt-3 border-t border-border pt-3">
                    <AdminLogoutButton className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-60" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-dark">
              Admin / {currentLabel}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-primary lg:text-4xl">
              {currentLabel}
            </h1>
          </div>
          {currentHref !== "/admin" && (
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:border-primary/40 hover:bg-white"
            >
              Back to overview
            </Link>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}
