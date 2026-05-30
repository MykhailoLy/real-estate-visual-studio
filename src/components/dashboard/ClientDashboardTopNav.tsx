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
  LogOut,
  Settings,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_CLIENT } from "@/lib/client-dashboard/mock-data";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/jobs", label: "Jobs", icon: Briefcase },
  { href: "/order", label: "New Order", icon: PlusCircle },
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

  const isActive = (item: DashboardNavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <header className="h-14 bg-primary border-b border-primary-dark flex items-center px-4 sm:px-6 gap-4 flex-shrink-0 z-40 sticky top-0">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2 flex-shrink-0"
        aria-label="PicchuSpot Dashboard home"
      >
        <span className="text-white font-bold text-lg tracking-tight leading-none">
          PicchuSpot
        </span>
        <span className="hidden sm:inline-block text-secondary text-[10px] font-semibold uppercase tracking-[0.15em] leading-none mt-0.5">
          Client Portal
        </span>
      </Link>

      {/* Desktop nav items */}
      <nav
        aria-label="Dashboard navigation"
        className="hidden lg:flex items-center gap-1 ml-6 flex-1"
      >
        {DASHBOARD_NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const isNewOrder = item.href === "/order";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold transition-colors",
                isNewOrder
                  ? "bg-secondary text-primary-dark hover:bg-secondary-light ml-2"
                  : active
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
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
      <div className="ml-auto flex items-center gap-3">
        {/* Credits placeholder badge */}
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 border border-white/20 rounded-full text-[11px] font-semibold text-white/80 cursor-default select-none">
          Credits: —
        </span>

        {/* User dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors text-white"
          >
            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-primary-dark">
                {MOCK_CLIENT.firstName.charAt(0)}
                {MOCK_CLIENT.lastName.charAt(0)}
              </span>
            </div>
            <span className="hidden sm:inline text-[13px] font-semibold">
              {MOCK_CLIENT.firstName}
            </span>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-200",
                userMenuOpen && "rotate-180"
              )}
              aria-hidden
            />
          </button>

          {userMenuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
                aria-hidden
              />
              {/* Dropdown panel */}
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 bg-white border border-border rounded-xl shadow-xl py-1.5 z-50"
              >
                <div className="px-4 py-2.5 border-b border-border">
                  <p className="text-sm font-semibold text-foreground">
                    {MOCK_CLIENT.name}
                  </p>
                  <p className="text-xs text-muted">{MOCK_CLIENT.email}</p>
                </div>
                <Link
                  href="/dashboard/profile"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground/80 hover:bg-surface hover:text-primary transition-colors"
                >
                  <User className="w-4 h-4" aria-hidden />
                  Profile
                </Link>
                <Link
                  href="/dashboard/support"
                  role="menuitem"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground/80 hover:bg-surface hover:text-primary transition-colors"
                >
                  <Settings className="w-4 h-4" aria-hidden />
                  Settings
                </Link>
                <div className="border-t border-border mt-1 pt-1">
                  <button
                    role="menuitem"
                    type="button"
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground/60 hover:bg-surface hover:text-foreground transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <LogOut className="w-4 h-4" aria-hidden />
                    Sign out
                  </button>
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
          className="lg:hidden p-1.5 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Menu className="w-5 h-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}
