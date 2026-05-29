"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// FAQ ACCORDION
//
// Accessible, keyboard-navigable accordion for FAQ content on
// pricing / service pages. Each item is a <details>-style
// open/close panel controlled via useState so we can animate
// the chevron without relying on CSS :open selectors.
//
// Styling stays consistent with the rest of the design system:
// deep-navy headings, muted body text, stone-200 borders, and
// the same rounded-2xl card language used across pricing pages.
// ============================================================

export interface FaqItem {
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

export default function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) =>
    setOpenIndex((prev) => (prev === i ? null : i));

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={item.question}
            className={cn(
              "rounded-2xl border bg-white transition-shadow",
              isOpen
                ? "border-primary/25 shadow-md"
                : "border-stone-200 shadow-sm hover:border-stone-300"
            )}
          >
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 px-5 lg:px-6 py-4 lg:py-5 text-left focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 rounded-2xl"
            >
              <span className="text-sm lg:text-base font-semibold text-primary leading-snug">
                {item.question}
              </span>
              <ChevronDown
                className={cn(
                  "w-5 h-5 flex-shrink-0 text-muted transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
                aria-hidden
              />
            </button>

            {/* Answer panel — rendered in DOM always so height
                transition works; hidden via max-height + overflow. */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-200",
                isOpen ? "max-h-[600px]" : "max-h-0"
              )}
              aria-hidden={!isOpen}
            >
              <p className="px-5 lg:px-6 pb-5 text-sm lg:text-base text-muted leading-relaxed">
                {item.answer}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
