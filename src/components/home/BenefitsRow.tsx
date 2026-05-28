import {
  Clock,
  CreditCard,
  RefreshCw,
  Eye,
  ShieldCheck,
  Globe,
} from "lucide-react";

// ============================================================
// "Why work with PicchuSpot" — benefits row
//
// Six cards. Layout adapts:
//   < sm     1 col       — single stack on phones
//   sm       2 cols      — pair-up on small tablets
//   lg       3 cols      — comfortable 3+3 on desktop
//   2xl+     6 cols      — single horizontal row on very wide
//                          displays where the cards still read
//                          comfortably without cramping the body
//
// Card padding scales down at 2xl so the six-in-a-row variant
// doesn't feel cramped. Original PicchuSpot copy only — exact
// strings supplied by the spec.
// ============================================================

const BENEFITS = [
  {
    icon: Clock,
    title: "Fast Turnaround",
    body: "Standard delivery in 24-48 hours from the moment we have everything we need.",
  },
  {
    icon: CreditCard,
    title: "No Subscriptions",
    body: "Pay per image or per project. No monthly fees, no minimum commitments.",
  },
  {
    icon: RefreshCw,
    title: "Revisions Included",
    body: "One revision is included on every item so the final result matches your brief.",
  },
  {
    icon: Eye,
    title: "Real Human Review",
    body: "Every order is checked by an editor for realism and listing-quality presentation.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Uploads",
    body: "Files go straight to private storage over signed URLs. Your photos stay yours.",
  },
  {
    icon: Globe,
    title: "Remote + Local",
    body: "Worldwide remote editing plus on-location photography in Alicante and Costa Blanca.",
  },
];

export default function BenefitsRow() {
  return (
    <section className="py-12 lg:py-16 bg-surface border-y border-border">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="max-w-3xl mb-8 lg:mb-12">
          <h2 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05]">
            Why work with PicchuSpot
          </h2>
          <p className="mt-3 text-base lg:text-xl text-muted leading-relaxed">
            Built for listings — not generic photo work.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-5 lg:gap-6 2xl:gap-5">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className="group relative bg-white border border-stone-200 rounded-2xl p-6 lg:p-7 2xl:p-5 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                {/* Top accent stripe — appears on hover */}
                <span
                  aria-hidden
                  className="absolute top-0 left-6 right-6 h-0.5 rounded-b-full bg-secondary scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-300"
                />
                <div className="w-12 h-12 lg:w-14 lg:h-14 2xl:w-12 2xl:h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 lg:mb-5 2xl:mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                  <Icon
                    className="w-6 h-6 lg:w-7 lg:h-7 2xl:w-6 2xl:h-6 text-primary group-hover:text-white transition-colors"
                    aria-hidden
                  />
                </div>
                <h3 className="font-bold text-foreground text-base lg:text-lg 2xl:text-base tracking-tight">
                  {b.title}
                </h3>
                <p className="mt-2 text-sm lg:text-[15px] 2xl:text-[13px] text-muted leading-relaxed">
                  {b.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
