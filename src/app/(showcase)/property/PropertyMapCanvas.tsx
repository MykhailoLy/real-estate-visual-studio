import { ExternalLink } from "lucide-react";
import type { PropertyMapView } from "@/features/property-showcase/listing-details";

interface PropertyMapCanvasProps {
  mapView: PropertyMapView;
  title: string;
  openLabel: string;
  troubleLabel: string;
  compact?: boolean;
}

export default function PropertyMapCanvas({
  mapView,
  title,
  openLabel,
  troubleLabel,
  compact = false,
}: PropertyMapCanvasProps) {
  if (mapView.mode !== "embed" || !mapView.embedUrl) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-[0_12px_35px_rgba(15,36,64,0.08)]">
      <div
        className={`relative ${
          compact
            ? "aspect-[16/9] min-h-[260px]"
            : "aspect-[16/9] min-h-[340px] sm:min-h-[420px] lg:min-h-[500px]"
        }`}
      >
        <iframe
          src={mapView.embedUrl}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          data-testid="property-map-iframe"
        />

        {mapView.markerMode === "approximate" ? (
          <div
            data-testid="approximate-map-area"
            className="pointer-events-none absolute inset-0 grid place-items-center"
            aria-hidden="true"
          >
            <div className="h-28 w-28 rounded-full border-2 border-[#0f2440]/70 bg-[#d4bc6a]/25 shadow-[0_0_0_12px_rgba(255,255,255,0.32)] sm:h-36 sm:w-36" />
          </div>
        ) : null}
      </div>

      {mapView.externalUrl ? (
        <div className="flex flex-col items-start gap-3 border-t border-black/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="text-xs font-medium text-slate-500 sm:text-sm">
            {troubleLabel}
          </span>
          <a
            href={mapView.externalUrl}
            target="_blank"
            rel="noreferrer"
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
