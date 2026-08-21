"use client";

import Container from "@/components/layout/Container";
import { cn } from "@/lib/utils";

interface OrderLayoutProps {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  /** Optional right-hand action/summary rail. */
  sidebar?: React.ReactNode;
  /**
   * Optional informational rail rendered before the form on wide screens.
   * It disappears below xl without reserving space for order forms that need
   * the full tablet/mobile width.
   */
  leadingRail?: React.ReactNode;
  /**
   * Optional content rendered above the title (e.g. a step indicator).
   * Kept optional so existing order forms are unaffected.
   */
  header?: React.ReactNode;
  /** Larger, calmer type and spacing for visually led order flows. */
  editorial?: boolean;
}

export default function OrderLayout({
  title,
  subtitle,
  children,
  sidebar,
  leadingRail,
  header,
  editorial = false,
}: OrderLayoutProps) {
  const hasLeadingRail = leadingRail != null;
  const hasSidebar = sidebar != null;

  return (
    // No `min-h-screen` here: this layout always renders INSIDE the
    // dashboard's single scroll container (ClientDashboardLayout <main>).
    // Forcing a viewport-tall section inside that already-constrained
    // scroll area produced nested viewport sizing and a large blank area
    // below the form. Natural content height lets the dashboard own the
    // scroll cleanly; the shell background fills any short-content gap.
    <section
      className={cn(
        "bg-surface",
        editorial ? "py-8 sm:py-10 lg:py-12" : "py-10 lg:py-16",
      )}
    >
      <Container>
        {header && <div className={editorial ? "mb-7 lg:mb-9" : "mb-8"}>{header}</div>}

        <div className={editorial ? "mb-8 max-w-4xl lg:mb-10" : "mb-8"}>
          <h1
            className={cn(
              "font-bold text-primary",
              editorial
                ? "mb-3 text-[28px] leading-tight sm:text-3xl lg:text-[32px]"
                : "mb-2 text-3xl lg:text-4xl",
            )}
          >
            {title}
          </h1>
          <p
            className={cn(
              "text-muted",
              editorial && "max-w-3xl text-base leading-7",
            )}
          >
            {subtitle}
          </p>
        </div>

        <div
          className={cn(
            "grid min-w-0 grid-cols-1 gap-8",
            hasLeadingRail &&
              !hasSidebar &&
              "xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] xl:gap-8 2xl:gap-10",
            !hasLeadingRail &&
              hasSidebar &&
              (editorial
                ? "xl:grid-cols-[minmax(0,1fr)_340px]"
                : "lg:grid-cols-[minmax(0,1fr)_340px]"),
            hasLeadingRail &&
              hasSidebar &&
              "xl:grid-cols-[minmax(220px,240px)_minmax(0,1fr)_340px]",
          )}
        >
          {hasLeadingRail && (
            <div className="hidden min-w-0 xl:block">
              <div className="sticky top-8">{leadingRail}</div>
            </div>
          )}

          {/* Main form area */}
          <div className={cn("min-w-0", editorial ? "space-y-7" : "space-y-6")}>
            {children}
          </div>

          {/* Sticky sidebar */}
          {hasSidebar && (
            <div className="min-w-0">
              <div
                className={editorial ? "xl:sticky xl:top-24" : "lg:sticky lg:top-24"}
              >
                {sidebar}
              </div>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
