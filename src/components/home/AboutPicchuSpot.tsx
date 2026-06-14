import Image from "next/image";
import ServicePlaceholder, {
  type ServiceVariant,
} from "./ServicePlaceholder";

// ============================================================
// ABOUT PICCHUSPOT
//
// Two-column layout: an asymmetric collage of five tiles on the
// larger side, narrative copy on the smaller side. The tile
// content is admin-managed via /admin/media (section
// "about-collage"). When fewer than five tiles are configured,
// remaining slots fall back to ServicePlaceholder variants so
// the section never shows blank tiles.
//
// The collage shape is fixed (1 anchor + 4 satellites). We layer
// admin tiles into the slot order — admins can reshuffle ordering
// via the sort_order field in /admin/media.
// ============================================================

/** A single collage tile. Either a real admin-uploaded image or
 *  one of the built-in placeholder variants. */
export type AboutCollageTile =
  | {
      kind: "image";
      id: string;
      url: string;
      alt: string;
    }
  | {
      kind: "placeholder";
      id: string;
      variant: ServiceVariant;
    };

interface Props {
  /** Up to 5 admin-uploaded tiles. Missing slots fall back to
   *  the default placeholder set so the layout still feels
   *  populated. */
  tiles?: AboutCollageTile[];
  copy?: AboutPicchuSpotCopy;
  placeholderLabels?: {
    left?: string;
    right?: string;
    ariaLabel?: string;
  };
}

export type AboutPicchuSpotCopy = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
};

/** Defaults that mirror the original hardcoded collage so
 *  fresh deploys without admin uploads still ship a polished
 *  About section. */
const FALLBACK_TILES: AboutCollageTile[] = [
  { kind: "placeholder", id: "fb-1", variant: "virtual-staging" },
  { kind: "placeholder", id: "fb-2", variant: "image-enhancement" },
  { kind: "placeholder", id: "fb-3", variant: "day-to-dusk" },
  { kind: "placeholder", id: "fb-4", variant: "floor-plans" },
  { kind: "placeholder", id: "fb-5", variant: "virtual-renovation" },
];

/** Pick the i-th tile, falling back to the i-th default when
 *  the admin hasn't supplied that many. Always returns a valid
 *  tile so the JSX below never has to null-check. */
function tileAt(tiles: AboutCollageTile[], i: number): AboutCollageTile {
  return tiles[i] ?? FALLBACK_TILES[i] ?? FALLBACK_TILES[0];
}

const DEFAULT_COPY: AboutPicchuSpotCopy = {
  eyebrow: "About PicchuSpot",
  title: "Listing-ready visuals, built by people who know real estate.",
  paragraphs: [
    "PicchuSpot creates listing-ready visuals for real estate marketing. With an architectural background and hands-on experience in 3D visualization, photo editing, and virtual staging, we focus on realistic results that help properties present better online.",
    "We provide remote digital services worldwide and local real estate media across Alicante and Costa Blanca. Whether it is a single image edit or a complete property media package, the goal is always the same: clear, polished visuals that help listings stand out.",
  ],
};

export default function AboutPicchuSpot({
  tiles = [],
  copy = DEFAULT_COPY,
  placeholderLabels,
}: Props) {
  // Only the first 5 admin tiles drive the collage. Anything
  // beyond that is ignored at render time but still visible in
  // /admin/media — admins can demote a tile by lowering its
  // sort_order rather than deleting it.
  const trimmed = tiles.slice(0, 5);

  const t0 = tileAt(trimmed, 0);
  const t1 = tileAt(trimmed, 1);
  const t2 = tileAt(trimmed, 2);
  const t3 = tileAt(trimmed, 3);
  const t4 = tileAt(trimmed, 4);

  return (
    <section className="py-16 lg:py-28 bg-surface" id="about">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Collage */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div className="grid grid-cols-3 grid-rows-3 gap-3 lg:gap-4 h-[440px] sm:h-[540px] lg:h-[640px]">
              {/* Big anchor tile (top-left, 2x2) */}
              <CollageCell
                tile={t0}
                className="col-span-2 row-span-2"
                placeholderLabels={placeholderLabels}
              />

              {/* Top-right column (1x1 + 1x1) */}
              <CollageCell tile={t1} placeholderLabels={placeholderLabels} />
              <CollageCell tile={t2} placeholderLabels={placeholderLabels} />

              {/* Bottom row (1x1 + 2x1) */}
              <CollageCell tile={t3} placeholderLabels={placeholderLabels} />
              <CollageCell
                tile={t4}
                className="col-span-2"
                placeholderLabels={placeholderLabels}
              />
            </div>
          </div>

          {/* Narrative */}
          <div className="lg:col-span-5 order-1 lg:order-2">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-secondary-dark mb-4">
              {copy.eyebrow}
            </p>
            <h2 className="text-3xl lg:text-5xl font-bold text-primary tracking-tight leading-[1.05]">
              {copy.title}
            </h2>
            <div className="mt-6 lg:mt-8 space-y-5 text-base lg:text-lg text-muted leading-relaxed">
              {copy.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * One cell of the collage. Renders an <img> for admin tiles and
 * a ServicePlaceholder for fallback tiles. Wrapper styling is
 * identical so swapping a placeholder for an admin upload (or
 * vice versa) doesn't reflow the layout.
 */
function CollageCell({
  tile,
  className,
  placeholderLabels,
}: {
  tile: AboutCollageTile;
  className?: string;
  placeholderLabels?: {
    left?: string;
    right?: string;
    ariaLabel?: string;
  };
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl shadow-md ring-1 ring-stone-200 ${
        className ?? ""
      }`}
    >
      {tile.kind === "image" ? (
        <Image
          src={tile.url}
          alt={tile.alt}
          fill
          // Collage lives in a ~58vw column on desktop, full width on
          // mobile; the largest (anchor) tile is ~40vw on desktop.
          sizes="(min-width: 1024px) 40vw, 90vw"
          className="object-cover"
        />
      ) : (
        <ServicePlaceholder variant={tile.variant} labels={placeholderLabels} />
      )}
    </div>
  );
}
