import { Compass, Cuboid, Wand2, Globe } from "lucide-react";

// ============================================================
// ABOUT PICCHUSPOT
// Short narrative anchored on the brand's specific background:
// architectural training, 3D visualization, real estate photo
// editing, and the remote-plus-local service split.
// ============================================================

const PILLARS = [
  {
    icon: Compass,
    title: "Architectural background",
    body: "An eye trained for proportion, light, and material so every visual feels grounded in real space.",
  },
  {
    icon: Cuboid,
    title: "3D visualization",
    body: "Renders, virtual staging, and renovation concepts that read as believable rather than rendered.",
  },
  {
    icon: Wand2,
    title: "Detail-focused editing",
    body: "Color, exposure, perspective, and clean-up work tuned for property listings — not generic photo retouching.",
  },
  {
    icon: Globe,
    title: "Remote + local",
    body: "Remote digital services worldwide and on-location photography in Alicante & Costa Blanca.",
  },
];

export default function AboutPicchuSpot() {
  return (
    <section className="py-16 lg:py-24 bg-white" id="about">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* Narrative */}
          <div className="lg:col-span-5">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-3">
              About
            </p>
            <h2 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.1]">
              PicchuSpot — Real Estate Visuals
            </h2>
            <div className="mt-5 space-y-4 text-base text-muted leading-relaxed">
              <p>
                PicchuSpot is a small studio focused entirely on real estate
                visuals. We sit at the intersection of architecture and
                marketing: comfortable inside a 3D scene, careful with the
                way a finished image will look on a listing page or
                inside a brochure.
              </p>
              <p>
                On the digital side, we deliver virtual staging, photo
                editing, virtual renovation, and floor plans for clients
                anywhere. On the local side, we handle photography, 360
                tours, and video for properties across Alicante and
                Costa Blanca.
              </p>
              <p>
                Whether the project is a single empty room or a full
                listing media package, the goal is the same: realistic,
                market-ready results that help the property sell.
              </p>
            </div>
          </div>

          {/* Pillars */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5">
              {PILLARS.map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.title}
                    className="bg-surface border border-stone-200 rounded-2xl p-5"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5 text-primary" aria-hidden />
                    </div>
                    <p className="font-semibold text-foreground">{p.title}</p>
                    <p className="mt-1.5 text-sm text-muted leading-relaxed">
                      {p.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
