import { Upload, PenTool, ScanSearch, PackageCheck } from "lucide-react";

// ============================================================
// HOW IT WORKS — 4-step homepage section
// ============================================================

const STEPS = [
  {
    icon: Upload,
    title: "Upload",
    body: "Upload your photos or project files from any device. Files go straight to private storage.",
  },
  {
    icon: PenTool,
    title: "We Edit",
    body: "We prepare your visuals based on the selected service and the instructions you submitted.",
  },
  {
    icon: ScanSearch,
    title: "Quality Review",
    body: "Every order is reviewed for realism, clarity, and presentation quality before delivery.",
  },
  {
    icon: PackageCheck,
    title: "Ready",
    body: "You receive market-ready files for your listing, MLS, website, or marketing package.",
  },
];

export default function HowItWorksDetailed() {
  return (
    <section className="py-16 lg:py-24 bg-surface" id="how-it-works">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-10 lg:mb-14">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
            Process
          </p>
          <h2 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.1]">
            How it works
          </h2>
          <p className="mt-4 text-base lg:text-lg text-muted leading-relaxed">
            From upload to delivery in four simple steps.
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const stepNumber = String(i + 1).padStart(2, "0");
            return (
              <li
                key={step.title}
                className="relative bg-white border border-stone-200 rounded-2xl p-6 shadow-sm"
              >
                <span
                  aria-hidden
                  className="absolute -top-3 left-6 inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-primary text-white text-[10px] font-bold tracking-[0.18em]"
                >
                  STEP {stepNumber}
                </span>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" aria-hidden />
                </div>
                <h3 className="font-semibold text-foreground text-lg">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
