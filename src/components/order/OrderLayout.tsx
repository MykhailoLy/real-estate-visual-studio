"use client";

import Container from "@/components/layout/Container";

interface OrderLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

export default function OrderLayout({
  title,
  subtitle,
  children,
  sidebar,
}: OrderLayoutProps) {
  return (
    <section className="py-10 lg:py-16 bg-surface min-h-screen">
      <Container>
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
