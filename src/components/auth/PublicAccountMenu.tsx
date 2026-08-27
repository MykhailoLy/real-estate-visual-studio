"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Briefcase,
  ChevronDown,
  LayoutDashboard,
  Loader2,
  LogOut,
  PlusCircle,
  User,
} from "lucide-react";
import { usePublicAuth } from "@/components/auth/PublicAuthContext";
import { getInitials } from "@/lib/client-auth-utils";
import { cn } from "@/lib/utils";

const accountMenuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/jobs", label: "Jobs", icon: Briefcase },
  { href: "/dashboard/orders/new", label: "New Order", icon: PlusCircle },
  { href: "/dashboard/profile", label: "My Account", icon: User },
] as const;

interface PublicAccountMenuProps {
  placement?: "bottom" | "top";
  variant?: "header" | "mobile-action";
  className?: string;
}

interface PanelPosition {
  top?: number;
  bottom?: number;
  right: number;
  width: number;
  maxHeight: number;
}

function PublicAccountAvatar({
  avatarUrl,
  initials,
  size,
}: {
  avatarUrl: string | null;
  initials: string;
  size: "small" | "large";
}) {
  return (
    <span
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-secondary-dark bg-cover bg-center font-bold text-primary-dark shadow-sm",
        size === "small" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs"
      )}
      style={avatarUrl ? { backgroundImage: `url("${avatarUrl}")` } : undefined}
      aria-hidden
    >
      {!avatarUrl && initials}
    </span>
  );
}

export default function PublicAccountMenu({
  placement = "bottom",
  variant = "header",
  className,
}: PublicAccountMenuProps) {
  const pathname = usePathname() ?? "/";
  const { user, signOut } = usePublicAuth();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelPos, setPanelPos] = useState<PanelPosition | null>(null);

  const displayName = user?.displayName ?? "Client";
  const firstName = user?.firstName ?? "Client";
  const initials = getInitials(displayName);
  const open = openPath === pathname;

  const updatePanelPosition = useCallback(() => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const viewportGutter = 12;
    const panelGap = 8;
    const width = Math.min(240, window.innerWidth - viewportGutter * 2);
    const right = Math.max(
      viewportGutter,
      Math.min(
        window.innerWidth - rect.right,
        window.innerWidth - width - viewportGutter
      )
    );

    if (placement === "top") {
      const bottom = Math.max(
        viewportGutter,
        window.innerHeight - rect.top + panelGap
      );
      setPanelPos({
        bottom,
        right,
        width,
        maxHeight: Math.max(0, window.innerHeight - bottom - viewportGutter),
      });
      return;
    }

    const top = rect.bottom + panelGap;
    setPanelPos({
      top,
      right,
      width,
      maxHeight: Math.max(0, window.innerHeight - top - viewportGutter),
    });
  }, [placement]);

  const close = useCallback(() => setOpenPath(null), []);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const insideButton = buttonRef.current?.contains(target) ?? false;
      const insidePanel = panelRef.current?.contains(target) ?? false;
      if (!insideButton && !insidePanel) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition);
    };
  }, [close, open, updatePanelPosition]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    const succeeded = await signOut();
    if (succeeded) close();
    setLoggingOut(false);
  };

  const mobileAction = variant === "mobile-action";

  return (
    <div
      className={cn(
        "relative min-w-0 flex-shrink-0",
        mobileAction && "w-full",
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
          "inline-flex min-w-0 items-center text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          mobileAction
            ? "h-[calc(3.5rem+env(safe-area-inset-bottom))] w-full gap-2 bg-primary px-4 pb-[env(safe-area-inset-bottom)] text-white hover:bg-primary-light focus-visible:ring-inset"
            : "h-9 min-w-[8.5rem] max-w-[10.5rem] gap-1.5 rounded-lg border border-stone-200 bg-white px-1.5 pr-2 shadow-sm hover:border-primary/30 hover:bg-surface"
        )}
      >
        <PublicAccountAvatar
          avatarUrl={user?.avatarUrl ?? null}
          initials={initials}
          size="small"
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left font-semibold",
            mobileAction ? "text-sm" : "text-xs"
          )}
        >
          {firstName}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 flex-shrink-0 transition-transform",
            mobileAction ? "text-white/75" : "text-primary/60",
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
              bottom: panelPos.bottom,
              right: panelPos.right,
              width: panelPos.width,
              maxHeight: panelPos.maxHeight,
              zIndex: 10001,
            }}
            className="overflow-y-auto rounded-xl border border-border bg-white py-1 shadow-2xl shadow-black/10"
          >
            <div className="border-b border-border bg-surface/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <PublicAccountAvatar
                  avatarUrl={user?.avatarUrl ?? null}
                  initials={initials}
                  size="large"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {displayName}
                  </p>
                  {user?.email && (
                    <p className="truncate text-[11px] text-muted">{user.email}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="py-1">
              {accountMenuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  role="menuitem"
                  onClick={close}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground/80 transition-colors hover:bg-surface hover:text-primary focus:outline-none focus-visible:bg-surface focus-visible:text-primary"
                >
                  <item.icon className="h-4 w-4 text-muted" aria-hidden />
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="border-t border-border py-1">
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-muted transition-colors hover:bg-surface hover:text-foreground focus:outline-none focus-visible:bg-surface focus-visible:text-foreground disabled:opacity-60"
              >
                {loggingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <LogOut className="h-4 w-4" aria-hidden />
                )}
                {loggingOut ? "Logging out..." : "Log Out"}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
