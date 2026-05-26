"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// TESTIMONIALS
//
// Single-card carousel with arrow + dot navigation. No autoplay
// — the spec explicitly does not require it and autoplaying
// quotes makes them harder to read. Three placeholder
// testimonials are wired here; real client wording will replace
// them later.
// ============================================================

interface Testimonial {
  name: string;
  role: string;
  /** Two-letter avatar initials, derived once at definition time
   *  so we never have to compute them client-side. */
  initials: string;
  quote: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Sarah Mitchell",
    role: "Real Estate Agent",
    initials: "SM",
    quote:
      "PicchuSpot helped us present listings in a cleaner and more polished way. The edits felt realistic, communication was clear, and turnaround was fast.",
  },
  {
    name: "Daniel Foster",
    role: "Property Marketer",
    initials: "DF",
    quote:
      "The visuals looked natural and listing-ready. We especially liked the attention to detail and the consistency across multiple images.",
  },
  {
    name: "Elena Ruiz",
    role: "Broker Associate",
    initials: "ER",
    quote:
      "The process was simple, and the final images looked professional without feeling over-edited.",
  },
];

export default function Testimonials() {
  const [idx, setIdx] = useState(0);
  const total = TESTIMONIALS.length;
  const current = TESTIMONIALS[idx];

  const goPrev = () => setIdx((i) => (i - 1 + total) % total);
  const goNext = () => setIdx((i) => (i + 1) % total);

  return (
    <section
      className="py-16 lg:py-28 bg-white"
      aria-labelledby="testimonials-heading"
    >
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="max-w-3xl mb-10 lg:mb-14">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
            Testimonials
          </p>
          <h2
            id="testimonials-heading"
            className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05]"
          >
            What Our Clients Say
          </h2>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Quote card */}
          <div
            className="relative bg-white border border-stone-200 rounded-3xl shadow-sm p-8 sm:p-12 lg:p-16"
            role="group"
            aria-roledescription="slide"
            aria-label={`Testimonial ${idx + 1} of ${total}`}
          >
            <Quote
              className="w-10 h-10 lg:w-14 lg:h-14 text-secondary mb-6 lg:mb-8"
              aria-hidden
            />
            <blockquote className="text-xl sm:text-2xl lg:text-3xl text-foreground font-medium leading-snug">
              <p>&ldquo;{current.quote}&rdquo;</p>
            </blockquote>
            <footer className="mt-8 lg:mt-10 flex items-center gap-4">
              <div
                className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-primary text-white flex items-center justify-center font-bold text-base lg:text-lg shadow-sm"
                aria-hidden
              >
                {current.initials}
              </div>
              <div>
                <p className="font-semibold text-foreground text-base lg:text-lg leading-tight">
                  {current.name}
                </p>
                <p className="text-sm lg:text-base text-muted">
                  {current.role}
                </p>
              </div>
            </footer>
          </div>

          {/* Controls */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous testimonial"
              className="w-11 h-11 rounded-full border border-stone-300 bg-white flex items-center justify-center text-foreground hover:border-primary hover:text-primary hover:bg-white transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden />
            </button>

            <div
              className="flex items-center gap-2"
              role="tablist"
              aria-label="Choose testimonial"
            >
              {TESTIMONIALS.map((t, i) => {
                const isActive = i === idx;
                return (
                  <button
                    key={t.name}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Show testimonial ${i + 1}: ${t.name}`}
                    onClick={() => setIdx(i)}
                    className={cn(
                      "h-2.5 rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                      isActive
                        ? "w-8 bg-primary"
                        : "w-2.5 bg-stone-300 hover:bg-stone-400"
                    )}
                  />
                );
              })}
            </div>

            <button
              type="button"
              onClick={goNext}
              aria-label="Next testimonial"
              className="w-11 h-11 rounded-full border border-stone-300 bg-white flex items-center justify-center text-foreground hover:border-primary hover:text-primary hover:bg-white transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              <ChevronRight className="w-5 h-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
