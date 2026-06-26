"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardAccountMenu } from "./ClientDashboardTopNav";

export default function ClientDashboardMobileBottomBar() {
  const pathname = usePathname() ?? "/dashboard";
  const supportActive = pathname.startsWith("/dashboard/support");

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 border-t border-primary/15 shadow-[0_-8px_24px_rgba(26,54,93,0.16)] md:hidden">
      <DashboardAccountMenu placement="top" variant="mobile-bottom" />

      <Link
        href="/dashboard/support"
        aria-current={supportActive ? "page" : undefined}
        className={cn(
          "inline-flex h-[calc(3.5rem+env(safe-area-inset-bottom))] min-w-0 items-center justify-center gap-2 px-3 pb-[env(safe-area-inset-bottom)] text-[14px] font-bold uppercase tracking-[0.08em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
          supportActive
            ? "bg-secondary text-primary-dark"
            : "bg-surface text-primary hover:bg-white"
        )}
      >
        <LifeBuoy
          className={cn(
            "h-4 w-4 flex-shrink-0",
            supportActive ? "text-primary-dark" : "text-secondary-dark"
          )}
          aria-hidden
        />
        <span className="truncate">Support</span>
      </Link>
    </div>
  );
}
