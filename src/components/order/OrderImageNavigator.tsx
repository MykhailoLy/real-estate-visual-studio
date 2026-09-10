"use client";

import { useEffect, useRef, useState } from "react";
import {
  resolveOrderImageTarget,
  selectActiveOrderImageId,
  shouldShowOrderImageNavigator,
  type OrderImageNavigationItem,
} from "@/lib/order-image-navigation";
import { cn } from "@/lib/utils";

interface OrderImageNavigatorProps {
  items: readonly OrderImageNavigationItem[];
  label?: string;
  itemLabel?: string;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function OrderImageNavigator({
  items,
  label = "Images",
  itemLabel = "Image",
}: OrderImageNavigatorProps) {
  const [activeItemId, setActiveItemId] = useState<string | null>(
    items[0]?.id ?? null,
  );
  const effectiveActiveItemId = items.some((item) => item.id === activeItemId)
    ? activeItemId
    : (items[0]?.id ?? null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const observedItems = items
      .map((item) => ({ item, element: document.getElementById(item.targetId) }))
      .filter(
        (entry): entry is { item: OrderImageNavigationItem; element: HTMLElement } =>
          entry.element !== null,
      );

    if (observedItems.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const itemId = selectActiveOrderImageId(
          entries.map((entry) => ({
            id: entry.target.getAttribute("data-order-item-id"),
            isIntersecting: entry.isIntersecting,
            top: entry.boundingClientRect.top,
          })),
        );
        if (itemId) setActiveItemId(itemId);
      },
      { rootMargin: "-15% 0px -45% 0px", threshold: 0 },
    );

    observedItems.forEach(({ item, element }) => {
      element.setAttribute("data-order-item-id", item.id);
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
      observedItems.forEach(({ element }) => {
        element.removeAttribute("data-order-item-id");
      });
    };
  }, [items]);

  useEffect(() => {
    if (!effectiveActiveItemId) return;
    const button = buttonRefs.current.get(effectiveActiveItemId);
    const scroller = scrollerRef.current;
    if (!button || !scroller) return;

    const left =
      button.offsetLeft - scroller.clientWidth / 2 + button.clientWidth / 2;
    scroller.scrollTo({
      left: Math.max(0, left),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [effectiveActiveItemId]);

  if (!shouldShowOrderImageNavigator(items.length)) return null;

  const goToItem = (itemId: string) => {
    const targetId = resolveOrderImageTarget(items, itemId);
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (!target) return;

    setActiveItemId(itemId);
    target.scrollIntoView({
      block: "start",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  return (
    <nav
      aria-label={`${label} quick navigation`}
      className="sticky top-0 z-30 -mx-1 rounded-xl border border-border bg-surface/95 px-3 py-2 shadow-sm backdrop-blur sm:px-4"
    >
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-dashboard-kicker font-bold uppercase tracking-[0.08em] text-primary">
          {label}
        </span>
        <div
          ref={scrollerRef}
          className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]"
        >
          <div className="flex w-max gap-1.5 py-0.5">
            {items.map((item, index) => {
              const active = item.id === effectiveActiveItemId;
              return (
                <button
                  key={item.id}
                  ref={(node) => {
                    if (node) buttonRefs.current.set(item.id, node);
                    else buttonRefs.current.delete(item.id);
                  }}
                  type="button"
                  onClick={() => goToItem(item.id)}
                  aria-label={`Go to ${itemLabel} ${index + 1}`}
                  aria-current={active ? "location" : undefined}
                  className={cn(
                    "grid h-11 min-w-11 shrink-0 place-items-center rounded-lg border px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    active
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-white text-primary hover:border-primary/40 hover:bg-dashboard-canvas",
                  )}
                >
                  {index + 1}
                  <span className="sr-only">{active ? " (current)" : ""}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
