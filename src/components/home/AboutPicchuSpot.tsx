import ServicePlaceholder from "./ServicePlaceholder";

// ============================================================
// ABOUT PICCHUSPOT
//
// Two-column layout: an asymmetric collage of placeholder tiles
// on the larger side, narrative copy on the smaller side. The
// tiles use the existing ServicePlaceholder variants so the
// section still feels visually coherent with the homepage's
// before/after vocabulary, but the layout reads as "About"
// rather than another service grid. Real images can replace the
// placeholders later by swapping out tile contents.
// ============================================================

export default function AboutPicchuSpot() {
  return (
    <section className="py-16 lg:py-28 bg-surface" id="about">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Collage */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div
              className="grid grid-cols-3 grid-rows-3 gap-3 lg:gap-4 h-[440px] sm:h-[540px] lg:h-[640px]"
              aria-hidden
            >
              {/* Big anchor tile (top-left, 2x2) */}
              <div className="col-span-2 row-span-2 relative overflow-hidden rounded-2xl shadow-md ring-1 ring-stone-200">
                <ServicePlaceholder variant="virtual-staging" />
              </div>

              {/* Top-right column (1x1 + 1x1) */}
              <div className="relative overflow-hidden rounded-2xl shadow-md ring-1 ring-stone-200">
                <ServicePlaceholder variant="image-enhancement" />
              </div>
              <div className="relative overflow-hidden rounded-2xl shadow-md ring-1 ring-stone-200">
                <ServicePlaceholder variant="day-to-dusk" />
              </div>

              {/* Bottom row (1x1 + 2x1) */}
              <div className="relative overflow-hidden rounded-2xl shadow-md ring-1 ring-stone-200">
                <ServicePlaceholder variant="floor-plans" />
              </div>
              <div className="col-span-2 relative overflow-hidden rounded-2xl shadow-md ring-1 ring-stone-200">
                <ServicePlaceholder variant="virtual-renovation" />
              </div>
            </div>
          </div>

          {/* Narrative */}
          <div className="lg:col-span-5 order-1 lg:order-2">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
              About PicchuSpot
            </p>
            <h2 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05]">
              Listing-ready visuals, built by people who know real estate.
            </h2>
            <div className="mt-6 lg:mt-8 space-y-5 text-base lg:text-lg text-muted leading-relaxed">
              <p>
                PicchuSpot creates listing-ready visuals for real estate
                marketing. With an architectural background and hands-on
                experience in 3D visualization, photo editing, and
                virtual staging, we focus on realistic results that help
                properties present better online.
              </p>
              <p>
                We provide remote digital services worldwide and local
                real estate media across Alicante and Costa Blanca.
                Whether it is a single image edit or a complete property
                media package, the goal is always the same: clear,
                polished visuals that help listings stand out.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
