"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Briefcase,
  PlusCircle,
  FolderOpen,
  Receipt,
  LifeBuoy,
  ChevronDown,
  User,
  ArrowUpRight,
  Coins,
  Menu,
} from "lucide-react";
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
  { href: "/dashboard/files", label: "Files", icon: FolderOpen },
  { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
];

interface ClientDashboardTopNavProps {
  onMobileMenuToggle: () => void;
  mobileMenuOpen: boolean;
}

export default function ClientDashboardTopNav({
  onMobileMenuToggle,
  mobileMenuOpen,
}: ClientDashboardTopNavProps) {
  const pathname = usePathname() ?? "/dashboard";
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Read user from context (set by the server layout)
  const user = useDashboardUser();

  const displayName = user?.displayName || "Client";
  const firstName   = user?.profileName || user?.firstName || displayName.split(" ")[0];
  const email       = user?.email       || "";
  const initials    = getInitials(displayName);
  const isLiveUser  = Boolean(user?.email);

  const isActive = (item: DashboardNavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <header className="h-14 bg-primary border-b border-primary-dark/60 flex items-center px-4 sm:px-6 gap-4 flex-shrink-0 z-40 sticky top-0 shadow-sm">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 flex-shrink-0 group"
        aria-label="PicchuSpot Dashboard home"
      >
        <span className="text-white font-bold text-[15px] tracking-tight leading-none group-hover:text-white/90 transition-colors">
          PicchuSpot
        </span>
        <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 bg-white/10 border border-white/15 rounded text-secondary text-[9px] font-bold uppercase tracking-[0.18em] leading-none">
          Portal
        </span>
      </Link>

      <div className="hidden lg:block w-px h-5 bg-white/15 flex-shrink-0" />

      {/* Desktop nav */}
      <nav
        aria-label="Dashboard navigation"
        className="hidden lg:flex items-center gap-0.5 flex-1"
      >
        {DASHBOARD_NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const isNewOrder = item.href === "/dashboard/orders/new";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold transition-all duration-150",
                isNewOrder
                  ? "bg-secondary text-primary-dark hover:bg-secondary-light ml-1 shadow-sm"
                  : active
                  ? "bg-white/18 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                  : "text-white/65 hover:text-white hover:bg-white/10"
              )}
              aria-current={active && !isNewOrder ? "page" : undefined}
            >
              <item.icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        {/* Back to website */}
        <Link
          href="/"
          className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold text-white/55 hover:text-white/90 transition-colors rounded-md hover:bg-white/8"
        >
          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />
          <span className="hidden xl:inline">Back to website</span>
        </Link>

        <div className="hidden md:block w-px h-4 bg-white/15" />

        {/* Credits placeholder */}
        <div
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/8 border border-white/12 rounded-full cursor-default select-none"
          title="Credits feature coming soon"
        >
          <Coins className="w-3 h-3 text-secondary/70" aria-hidden />
          <span className="text-[11px] font-semibold text-white/50">Credits</span>
          <span className="text-[11px] font-bold text-white/30">—</span>
        </div>

        {/* Files/invoices are still mock data — pill stays until Phase 5B */}
        <span
          className="hidden sm:inline-flex items-center px-2 py-0.5 bg-secondary/15 border border-secondary/25 rounded-full text-[10px] font-bold uppercase tracking-[0.12em] text-secondary/80 select-none cursor-default"
          title="Files and invoices shown are sample data. Jobs now show real orders."
        >
          Files: demo
        </span>

        {/* User dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/18 border border-white/10 hover:border-white/20 transition-all text-white"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-secondary to-secondary-dark flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-[10px] font-bold text-primary-dark leading-none">
                {initials}
              </span>
            </div>
            <span className="hidden sm:inline text-[13px] font-semibold leading-none">
              {firstName}
            </span>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-white/60 transition-transform duration-200",
                userMenuOpen && "rotate-180"
              )}
              aria-hidden
            />
          </button>

          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
                aria-hidden
              />
              <div
                role="menu"
                className="absolute right-0 mt-2 w-60 bg-white border border-border rounded-xl shadow-2xl shadow-black/10 py-1 z-50 overflow-hidden"
              >
                {/* Identity block */}
                <div className="px-4 py-3 border-b border-border bg-surface/60">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-white">{initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground leading-tight truncate">
                        {displayName}
                      </p>
                      <p className="text-[11px] text-muted truncate">{email}</p>
                    </div>
                  </div>
                  {isLiveUser ? (
                    <div className="mt-2.5 flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200/60 rounded-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" aria-hidden />
                      <p className="text-[11px] text-emerald-700 font-semibold">
                        Signed in · Files &amp; invoices are sample data
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2.5 flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-200/60 rounded-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" aria-hidden />
                      <p className="text-[11px] text-amber-700 font-semibold">
                        Demo mode — not signed in
                      </p>
                    </div>
                  )}
                </div>

                <div className="py-1">
                  <Link
                    href="/dashboard/profile"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground/80 hover:bg-surface hover:text-primary transition-colors"
                  >
                    <User className="w-4 h-4 text-muted" aria-hidden />
                    Profile
                  </Link>
                  <Link
                    href="/dashboard/support"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground/80 hover:bg-surface hover:text-primary transition-colors"
                  >
                    <LifeBuoy className="w-4 h-4 text-muted" aria-hidden />
                    Support
                  </Link>
                  <Link
                    href="/"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground/80 hover:bg-surface hover:text-primary transition-colors"
                  >
                    <ArrowUpRight className="w-4 h-4 text-muted" aria-hidden />
                    Back to website
                  </Link>
                </div>

                <div className="border-t border-border py-1">
                  <SignOutButton
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted hover:bg-surface hover:text-foreground transition-colors disabled:opacity-60"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Mobile burger */}
        <button
          type="button"
          onClick={onMobileMenuToggle}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          className="lg:hidden p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Menu className="w-5 h-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}
