"use client";

import { ArrowRight } from "lucide-react";
import Container from "@/components/layout/Container";
import SelectorMediaTile from "@/components/order/SelectorMediaTile";
import { VIRTUAL_RENOVATION_GUIDE_ITEMS } from "@/data/order-options";
import type { ServiceOptionMedia } from "@/lib/site-media";

interface VirtualRenovationOverviewProps {
  mediaByKey: Record<string, ServiceOptionMedia>;
  onStart: () => void;
}

function mediaUrl(media: ServiceOptionMedia | undefined): string | null {
  return media?.imageUrl ?? media?.afterUrl ?? media?.beforeUrl ?? null;
}

export default function VirtualRenovationOverview({
  mediaByKey,
  onStart,
}: VirtualRenovationOverviewProps) {
  return (
    <section className="bg-surface py-10 lg:py-16">
      <Container>
        <div className="max-w-3xl">
          <p className="mb-1.5 text-dashboard-kicker uppercase font-bold text-secondary-dark">
            New Order
          </p>
          <h1 className="text-3xl font-bold text-primary lg:text-4xl">
            Virtual Renovation
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
            Prepare the original image, renovation direction and any references
            before starting your order.
          </p>
        </div>

        <div className="mt-9 space-y-10">
          <h2 className="text-dashboard-section lg:text-lg font-bold text-primary">
            What we need
          </h2>

          {(["external", "internal"] as const).map((group) => (
            <section
              key={group}
              aria-labelledby={`virtual-renovation-${group}-guide-title`}
            >
              <div className="mb-4 flex items-center gap-4">
                <h3
                  id={`virtual-renovation-${group}-guide-title`}
                  className="text-xl font-semibold text-foreground"
                >
                  {group === "external"
                    ? "External Renovation"
                    : "Internal Renovation"}
                </h3>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {VIRTUAL_RENOVATION_GUIDE_ITEMS.filter(
                  (item) => item.group === group,
                ).map((item) => {
                  const media = mediaByKey[item.mediaKey];
                  return (
                    <article
                      key={item.mediaKey}
                      className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
                    >
                      <SelectorMediaTile
                        url={mediaUrl(media)}
                        alt={
                          media?.altText?.trim() ||
                          `${group === "external" ? "External" : "Internal"} renovation ${item.title.toLowerCase()} example`
                        }
                        sizes="(min-width: 1024px) 29vw, (min-width: 768px) 45vw, 92vw"
                      />
                      <div className="p-5">
                        <h4 className="text-base font-semibold text-foreground">
                          {item.title}
                        </h4>
                        <p className="mt-1.5 text-dashboard-body text-muted">
                          {item.description}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-10 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
        >
          Start Virtual Renovation Order
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </Container>
    </section>
  );
}
