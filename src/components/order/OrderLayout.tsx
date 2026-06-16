"use client";

import Container from "@/components/layout/Container";

interface OrderLayoutProps {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  sidebar: React.ReactNode;
  /**
   * Optional content rendered above the title (e.g. a step indicator).
   * Kept optional so existing order forms are unaffected.
   */
  header?: React.ReactNode;
}

export default function OrderLayout({
  title,
  subtitle,
  children,
  sidebar,
  header,
}: OrderLayoutProps) {
  return (
    // No `min-h-screen` here: this layout always renders INSIDE the
    // dashboard's single scroll container (ClientDashboardLayout <main>).
    // Forcing a viewport-tall section inside that already-constrained
    // scroll area produced nested viewport sizing and a large blank area
    // below the form. Natural content height lets the dashboard own the
    // scroll cleanly; the shell background fills any short-content gap.
    <section className="py-10 lg:py-16 bg-surface">
      <Container>
        {header && <div className="mb-8">{header}</div>}

        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-primary mb-2">
            {title}
          </h1>
          <p className="text-muted">{subtitle}</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main form area */}
          <div className="flex-1 space-y-6">{children}</div>

          {/* Sticky sidebar */}
          <div className="lg:w-[340px] flex-shrink-0">
            <div className="lg:sticky lg:top-24">{sidebar}</div>
          </div>
        </div>
      </Container>
    </section>
  );
}
