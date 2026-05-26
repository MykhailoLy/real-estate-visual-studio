import { MessagesSquare, Sparkles, Timer, Search } from "lucide-react";

// ============================================================
// WHAT CLIENTS VALUE
//
// Intentionally NOT a testimonial wall — we don't want to invent
// fake quotes. These are the value statements clients tell us
// matter to them, written in our own voice.
// ============================================================

const VALUES = [
  {
    icon: MessagesSquare,
    title: "Clear communication",
    body: "You always know what we're working on, what we need, and when to expect delivery.",
  },
  {
    icon: Sparkles,
    title: "Realistic results",
    body: "Edits that hold up on close inspection — no plastic skies or floating furniture.",
  },
  {
    icon: Timer,
    title: "Fast delivery",
    body: "Standard turnaround in 24-48 hours so listings don't sit waiting on visuals.",
  },
  {
    icon: Search,
    title: "Detail-focused editing",
    body: "Every image is checked for the small things — perspective, reflections, color, edges.",
  },
];

export default function ClientsValue() {
  return (
    <section className="py-16 lg:py-24 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-10 lg:mb-14">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
            What clients value
          </p>
          <h2 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.1]">
            Built around what real estate teams actually need
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {VALUES.map((v) => {
            const Icon = v.icon;
            return (
              <div
                key={v.title}
                className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" aria-hidden />
                </div>
                <p className="font-semibold text-foreground">{v.title}</p>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  {v.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
