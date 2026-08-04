import { ExternalLink } from "lucide-react";
import type { PropertyMapView } from "@/features/property-showcase/listing-details";

interface PropertyMapCanvasProps {
  mapView: PropertyMapView;
  title: string;
  openLabel: string;
  troubleLabel: string;
  compact?: boolean;
}

function approximateCircleDiameter(mapView: PropertyMapView): number {
  const latitude = mapView.centerLatitude ?? 0;
  const zoom = mapView.mapZoom ?? 11;
  const radius = mapView.approximateRadiusMeters ?? 1500;
  const metersPerPixel =
    (156543.03392 * Math.cos((latitude * Math.PI) / 180)) /
    2 ** zoom;

  return Math.min(
    560,
    Math.max(64, Math.round((radius * 2) / Math.max(metersPerPixel, 0.1))),
  );
}

export default function PropertyMapCanvas({
  mapView,
  title,
  openLabel,
  troubleLabel,
  compact = false,
}: PropertyMapCanvasProps) {
  if (mapView.mode !== "embed" || !mapView.embedUrl) return null;
  const approximateDiameter = approximateCircleDiameter(mapView);
  const isApproximate = mapView.markerMode === "approximate";

  return (
    <div
      className={
        compact
          ? "overflow-hidden rounded-lg border border-black/10 bg-white shadow-[0_12px_35px_rgba(15,36,64,0.08)]"
          : "w-full overflow-hidden border-y border-black/10 bg-white"
      }
    >
      <div
        className={`relative ${
          compact
            ? "aspect-[16/9] min-h-[260px]"
            : "h-[62svh] min-h-[360px] max-h-[680px] sm:min-h-[460px]"
        }`}
      >
        <iframe
          src={mapView.embedUrl}
          title={title}
          className={`absolute inset-0 h-full w-full border-0 ${
            isApproximate ? "pointer-events-none" : ""
          }`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          tabIndex={isApproximate ? -1 : undefined}
          data-testid="property-map-iframe"
        />

        {isApproximate ? (
          <div
            data-testid="approximate-map-area"
            className="pointer-events-none absolute inset-0 grid place-items-center"
            aria-hidden="true"
          >
            <div
              className="rounded-full border-2 border-[#0f2440]/75 bg-[#d4bc6a]/25 shadow-[0_0_0_10px_rgba(255,255,255,0.28)]"
              style={{
                width: `min(${approximateDiameter}px, ${compact ? "72%" : "78vw"})`,
                aspectRatio: "1",
              }}
            />
          </div>
        ) : null}
      </div>

      {mapView.externalUrl ? (
        <div className="flex flex-col items-start gap-3 border-t border-black/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <span className="text-xs font-medium text-slate-500 sm:text-sm">
            {troubleLabel}
          </span>
          <a
            href={mapView.externalUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={openLabel}
            title={openLabel}
            data-testid="property-map-external-link"
            className="inline-flex items-center gap-2 rounded-full border border-[#0f2440]/20 bg-white px-4 py-2.5 text-sm font-bold text-[#0f2440] transition hover:border-[#0f2440]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            {openLabel}
          </a>
        </div>
      ) : null}
    </div>
  );
}
