"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PanoramaHeroViewerProps {
  imageUrl: string | null;
  title: string;
  fallbackLabel: string;
}

const AUTO_ROTATE_DEGREES_PER_MS = 0.004;
const DRAG_SENSITIVITY = 0.12;

export default function PanoramaHeroViewer({
  imageUrl,
  title,
  fallbackLabel,
}: PanoramaHeroViewerProps) {
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(
    null
  );

  const hasImage = Boolean(imageUrl) && failedImageUrl !== imageUrl;

  useEffect(() => {
    if (!imageUrl) return;

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        setFailedImageUrl((current) => (current === imageUrl ? null : current));
      }
    };
    img.onerror = () => {
      if (!cancelled) setFailedImageUrl(imageUrl);
    };
    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!hasImage || isDragging || reducedMotion) return;

    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      setYaw((current) => (current + delta * AUTO_ROTATE_DEGREES_PER_MS) % 360);
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [hasImage, isDragging, reducedMotion]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!hasImage || !event.isPrimary) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        x: event.clientX,
        y: event.clientY,
        yaw,
        pitch,
      };
      setIsDragging(true);
    },
    [hasImage, pitch, yaw]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || !event.isPrimary) return;

      const dx = event.clientX - dragRef.current.x;
      const dy = event.clientY - dragRef.current.y;
      setYaw((dragRef.current.yaw - dx * DRAG_SENSITIVITY + 360) % 360);
      setPitch(
        Math.max(-22, Math.min(22, dragRef.current.pitch + dy * DRAG_SENSITIVITY))
      );
    },
    []
  );

  const stopDragging = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragRef.current = null;
      setIsDragging(false);
    },
    []
  );

  const backgroundPosition = `${yaw.toFixed(2)}% ${50 + pitch}%`;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl lg:rounded-2xl shadow-xl ring-1 ring-black/10",
        "aspect-[16/9] sm:aspect-[21/9] md:aspect-[3/1] lg:aspect-[4/1]",
        hasImage ? "cursor-grab active:cursor-grabbing bg-stone-950" : "bg-primary"
      )}
      data-panorama-state={hasImage ? "loaded" : "fallback"}
      data-yaw={Math.round(yaw)}
      role="img"
      aria-label={hasImage ? title : fallbackLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
    >
      {hasImage ? (
        <div
          className="absolute inset-0 bg-center bg-repeat-x"
          style={{
            backgroundImage: `url("${imageUrl}")`,
            backgroundPosition,
            backgroundSize: "auto 230%",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(120deg,#071f34_0%,#183d5d_46%,#d9c7a5_100%)]">
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/20" />
          <div className="absolute left-[12%] top-[22%] h-20 w-28 rounded-full border border-white/20" />
          <div className="absolute right-[16%] bottom-[20%] h-24 w-36 rounded-full border border-white/15" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(4,16,28,0.28)_75%)]" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-white">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] backdrop-blur">
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
            360 viewer
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            {hasImage ? "Drag to look around" : "Upload a Service hero panorama"}
          </span>
        </div>
      </div>
    </div>
  );
}
