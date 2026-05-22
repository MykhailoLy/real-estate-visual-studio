type Variant =
  | "staging"
  | "renovation"
  | "editing"
  | "floor-plan"
  | "pool"
  | "background"
  | "color"
  | "dusk"
  | "object-removal"
  | "enhancement";

interface BeforeAfterPlaceholderProps {
  variant?: Variant;
  beforeLabel?: string;
  afterLabel?: string;
  rounded?: "lg" | "xl" | "2xl";
  caption?: string;
}

function VariantBlocks({ variant }: { variant: Variant }) {
  switch (variant) {
    case "staging":
      return (
        <>
          <div className="w-1/2 bg-gradient-to-br from-stone-200 via-stone-200 to-stone-300" />
          <div className="w-1/2 bg-gradient-to-br from-amber-50 via-orange-100 to-stone-200" />
        </>
      );
    case "renovation":
      return (
        <>
          <div className="w-1/2 bg-gradient-to-br from-stone-300 via-stone-300 to-stone-400" />
          <div className="w-1/2 bg-gradient-to-br from-emerald-50 via-sky-50 to-stone-100" />
        </>
      );
    case "editing":
    case "enhancement":
      return (
        <>
          <div className="w-1/2 bg-gradient-to-br from-stone-500 via-stone-400 to-stone-500 saturate-50" />
          <div className="w-1/2 bg-gradient-to-br from-orange-100 via-amber-100 to-rose-100" />
        </>
      );
    case "dusk":
      return (
        <>
          <div className="w-1/2 bg-gradient-to-br from-sky-200 via-sky-100 to-stone-200" />
          <div className="w-1/2 bg-gradient-to-br from-orange-300 via-rose-300 to-indigo-700" />
        </>
      );
    case "object-removal":
      return (
        <>
          <div className="w-1/2 bg-gradient-to-br from-stone-300 via-stone-200 to-stone-300 relative overflow-hidden">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-stone-500/40" />
            <div className="absolute right-4 bottom-4 w-10 h-6 rounded-sm bg-stone-500/40" />
          </div>
          <div className="w-1/2 bg-gradient-to-br from-stone-100 via-stone-50 to-stone-100" />
        </>
      );
    case "pool":
      return (
        <>
          <div className="w-1/2 bg-gradient-to-br from-stone-400 via-stone-300 to-stone-400" />
          <div className="w-1/2 bg-gradient-to-br from-sky-200 via-cyan-200 to-blue-300" />
        </>
      );
    case "background":
      return (
        <>
          <div className="w-1/2 bg-gradient-to-br from-stone-300 via-stone-300 to-stone-400" />
          <div className="w-1/2 bg-gradient-to-br from-rose-100 via-amber-100 to-sky-100" />
        </>
      );
    case "color":
      return (
        <>
          <div className="w-1/2 bg-gradient-to-br from-stone-200 via-stone-200 to-stone-300" />
          <div className="w-1/2 bg-gradient-to-br from-emerald-100 via-teal-100 to-sky-100" />
        </>
      );
    case "floor-plan":
      return (
        <>
          <div className="w-1/2 relative bg-stone-100">
            <div
              className="absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(15,36,64,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(15,36,64,0.12) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            <div className="absolute inset-6 border-2 border-primary/30 rounded-sm bg-white/50" />
          </div>
          <div className="w-1/2 bg-gradient-to-br from-amber-50 via-stone-100 to-stone-200">
            <div className="absolute inset-6 border-2 border-primary/30 rounded-sm bg-white/30 hidden" />
          </div>
        </>
      );
  }
}

/**
 * Large before/after placeholder for pricing detail pages.
 * Pure CSS / gradient — designed to be replaced by real media later.
 */
export default function BeforeAfterPlaceholder({
  variant = "staging",
  beforeLabel = "Before",
  afterLabel = "After",
  rounded = "2xl",
  caption,
}: BeforeAfterPlaceholderProps) {
  const radius =
    rounded === "lg" ? "rounded-lg" : rounded === "xl" ? "rounded-xl" : "rounded-2xl";

  return (
    <div className="w-full">
      <div
        className={`relative w-full aspect-[16/9] ${radius} overflow-hidden border border-stone-200 shadow-sm bg-white`}
      >
        <div className="absolute inset-0 flex">
          <VariantBlocks variant={variant} />
        </div>

        {/* Center divider (visual cue for before/after split) */}
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/70 -translate-x-1/2" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-md border border-stone-200 flex items-center justify-center">
          <span className="text-[10px] font-bold tracking-wider text-primary">
            VS
          </span>
        </div>

        <div className="absolute top-4 left-4">
          <span className="text-[10px] font-bold tracking-[0.2em] text-stone-700 uppercase bg-white/85 backdrop-blur px-2.5 py-1 rounded-full">
            {beforeLabel}
          </span>
        </div>
        <div className="absolute top-4 right-4">
          <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase bg-white/85 backdrop-blur px-2.5 py-1 rounded-full">
            {afterLabel}
          </span>
        </div>

        {/* Top-right "media placeholder" hint */}
        <div className="absolute bottom-4 right-4">
          <span className="text-[10px] font-medium tracking-wide text-muted uppercase bg-white/85 backdrop-blur px-2.5 py-1 rounded-full">
            Media placeholder
          </span>
        </div>
      </div>
      {caption && (
        <p className="text-xs lg:text-sm text-muted mt-3 leading-relaxed">
          {caption}
        </p>
      )}
    </div>
  );
}
