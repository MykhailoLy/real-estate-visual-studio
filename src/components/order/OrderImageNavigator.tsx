"use client";

import { useEffect, useRef, useState } from "react";
import {
  calculateOrderImageScrollTop,
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
  const navRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const programmaticTargetRef = useRef<string | null>(null);

  useEffect(() => {
    const observedItems = items
      .map((item) => ({ item, element: document.getElementById(item.targetId) }))
      .filter(
        (entry): entry is { item: OrderImageNavigationItem; element: HTMLElement } =>
          entry.element !== null,
      );

    if (observedItems.length === 0) return;

    const scrollContainer = observedItems[0].element.closest<HTMLElement>(
      "[data-dashboard-scroll-container]",
    );
    const scrollTarget: HTMLElement | Window = scrollContainer ?? window;
    let animationFrame: number | null = null;

    const updateActiveItem = () => {
      animationFrame = null;
      const workingLine =
        (navRef.current?.getBoundingClientRect().bottom ?? 0) + 1;
      const isAtScrollEnd = scrollContainer
        ? scrollContainer.scrollTop > 0 &&
          scrollContainer.scrollTop + scrollContainer.clientHeight >=
            scrollContainer.scrollHeight - 1
        : window.scrollY > 0 &&
          window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 1;
      const itemId = selectActiveOrderImageId(
        observedItems.map(({ item, element }) => ({
          id: item.id,
          top: element.getBoundingClientRect().top,
        })),
        { workingLine, isAtScrollEnd },
      );

      if (!itemId) return;
      if (
        programmaticTargetRef.current &&
        itemId !== programmaticTargetRef.current
      ) {
        return;
      }

      programmaticTargetRef.current = null;
      setActiveItemId(itemId);
    };

    const scheduleUpdate = () => {
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(updateActiveItem);
      }
    };
    const clearProgrammaticTarget = () => {
      programmaticTargetRef.current = null;
    };

    scheduleUpdate();
    scrollTarget.addEventListener("scroll", scheduleUpdate, { passive: true });
    scrollTarget.addEventListener("wheel", clearProgrammaticTarget, {
      passive: true,
    });
    scrollTarget.addEventListener("touchstart", clearProgrammaticTarget, {
      passive: true,
    });
    scrollTarget.addEventListener("pointerdown", clearProgrammaticTarget, {
      passive: true,
    });
    window.addEventListener("resize", scheduleUpdate);
    document.addEventListener("keydown", clearProgrammaticTarget);

    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      scrollTarget.removeEventListener("scroll", scheduleUpdate);
      scrollTarget.removeEventListener("wheel", clearProgrammaticTarget);
      scrollTarget.removeEventListener("touchstart", clearProgrammaticTarget);
      scrollTarget.removeEventListener("pointerdown", clearProgrammaticTarget);
      window.removeEventListener("resize", scheduleUpdate);
      document.removeEventListener("keydown", clearProgrammaticTarget);
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

    programmaticTargetRef.current = itemId;
    setActiveItemId(itemId);
    const behavior = prefersReducedMotion() ? "auto" : "smooth";
    const navigatorHeight = navRef.current?.getBoundingClientRect().height ?? 0;
    const targetScrollMarginTop =
      Number.parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
    const scrollContainer = target.closest<HTMLElement>(
      "[data-dashboard-scroll-container]",
    );

    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: calculateOrderImageScrollTop({
          containerScrollTop: scrollContainer.scrollTop,
          containerTop: scrollContainer.getBoundingClientRect().top,
          targetTop: target.getBoundingClientRect().top,
          navigatorHeight,
          targetScrollMarginTop,
        }),
        behavior,
      });
      return;
    }

    window.scrollTo({
      top: calculateOrderImageScrollTop({
        containerScrollTop: window.scrollY,
        containerTop: 0,
        targetTop: target.getBoundingClientRect().top,
        navigatorHeight,
        targetScrollMarginTop,
      }),
      behavior,
    });
  };

  return (
    <nav
      ref={navRef}
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
