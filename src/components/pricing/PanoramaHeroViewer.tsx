"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Viewer as PhotoSphereViewer } from "@photo-sphere-viewer/core";

interface PanoramaHeroViewerProps {
  imageUrl: string | null;
  title: string;
  fallbackLabel: string;
}

const AUTO_ROTATE_RADIANS_PER_SECOND = 0.035;
const RESUME_AUTO_ROTATE_AFTER_MS = 2_600;

type ViewerState = {
  imageUrl: string | null;
  status: "fallback" | "ready";
};

export default function PanoramaHeroViewer({
  imageUrl,
  title,
  fallbackLabel,
}: PanoramaHeroViewerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<PhotoSphereViewer | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const yawFrameRef = useRef<number | null>(null);
  const [viewerState, setViewerState] = useState<ViewerState>({
    imageUrl: null,
    status: "fallback",
  });

  useEffect(() => {
    if (!imageUrl || !containerRef.current) return;

    const panoramaUrl = imageUrl;
    let cancelled = false;
    let localViewer: PhotoSphereViewer | null = null;
    let autoRotate = false;
    let lastFrame = 0;

    const clearResumeTimer = () => {
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
    };

    const stopYawSampling = () => {
      if (yawFrameRef.current) {
        window.cancelAnimationFrame(yawFrameRef.current);
        yawFrameRef.current = null;
      }
    };

    const resumeAutoRotate = () => {
      clearResumeTimer();
      resumeTimerRef.current = window.setTimeout(() => {
        autoRotate = true;
      }, RESUME_AUTO_ROTATE_AFTER_MS);
    };

    const pauseAutoRotate = () => {
      autoRotate = false;
      resumeAutoRotate();
    };

    const updateYawDataset = () => {
      if (viewerRef.current && rootRef.current) {
        rootRef.current.dataset.panoramaYaw = viewerRef.current
          .getPosition()
          .yaw.toFixed(4);
      }
    };

    const renderLoop = (now: number) => {
      const viewer = viewerRef.current;
      if (viewer) {
        if (autoRotate && lastFrame > 0) {
          const deltaSeconds = Math.min((now - lastFrame) / 1000, 0.08);
          const position = viewer.getPosition();
          viewer.rotate({
            yaw: position.yaw + AUTO_ROTATE_RADIANS_PER_SECOND * deltaSeconds,
            pitch: position.pitch,
          });
        }
        updateYawDataset();
      }
      lastFrame = now;
      yawFrameRef.current = window.requestAnimationFrame(renderLoop);
    };

    async function mountViewer() {
      try {
        const { Viewer } = await import("@photo-sphere-viewer/core");
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = "";
        localViewer = new Viewer({
          container: containerRef.current,
          panorama: panoramaUrl,
          navbar: false,
          mousewheel: false,
          keyboard: false,
          touchmoveTwoFingers: false,
          defaultYaw: 0,
          defaultPitch: 0,
          defaultZoomLvl: 30,
          minFov: 50,
          maxFov: 90,
          moveSpeed: 1.15,
          zoomSpeed: 0.7,
          moveInertia: 0.72,
          canvasBackground: "#0f172a",
          loadingTxt: "Loading 360 viewer",
        });

        viewerRef.current = localViewer;
        stopYawSampling();
        yawFrameRef.current = window.requestAnimationFrame(renderLoop);
        localViewer.addEventListener("ready", () => {
          if (!cancelled) {
            autoRotate = true;
            setViewerState({ imageUrl: panoramaUrl, status: "ready" });
          }
        });
        localViewer.addEventListener("panorama-error", () => {
          if (!cancelled) {
            setViewerState({ imageUrl: panoramaUrl, status: "fallback" });
          }
        });
      } catch {
        if (!cancelled) {
          setViewerState({ imageUrl: panoramaUrl, status: "fallback" });
        }
      }
    }

    mountViewer();
    const node = containerRef.current;
    node.addEventListener("pointerdown", pauseAutoRotate);
    node.addEventListener("wheel", pauseAutoRotate, { passive: true });
    window.addEventListener("pointerup", resumeAutoRotate);
    window.addEventListener("pointercancel", resumeAutoRotate);
    window.addEventListener("resize", resumeAutoRotate);

    return () => {
      cancelled = true;
      clearResumeTimer();
      stopYawSampling();
      node.removeEventListener("pointerdown", pauseAutoRotate);
      node.removeEventListener("wheel", pauseAutoRotate);
      window.removeEventListener("pointerup", resumeAutoRotate);
      window.removeEventListener("pointercancel", resumeAutoRotate);
      window.removeEventListener("resize", resumeAutoRotate);
      localViewer?.destroy();
      if (viewerRef.current === localViewer) viewerRef.current = null;
    };
  }, [imageUrl]);

  const state =
    imageUrl && viewerState.imageUrl === imageUrl
      ? viewerState.status
      : imageUrl
        ? "loading"
        : "fallback";
  const hasViewer = state === "loading" || state === "ready";

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative w-full overflow-hidden rounded-xl lg:rounded-2xl shadow-xl ring-1 ring-black/10",
        "aspect-[16/9] sm:aspect-[21/9] md:aspect-[3/1] lg:aspect-[4/1]",
        hasViewer ? "bg-stone-950" : "bg-primary"
      )}
      data-panorama-state={state}
      data-panorama-viewer="photo-sphere-viewer"
      role="img"
      aria-label={hasViewer ? title : fallbackLabel}
    >
      {hasViewer ? (
        <>
          <div
            ref={containerRef}
            className="absolute inset-0 [&_.psv-container]:!h-full [&_.psv-container]:!w-full [&_.psv-container]:!bg-stone-950 [&_.psv-container]:!font-sans [&_.psv-canvas-container]:!h-full [&_.psv-canvas-container]:!w-full"
          />
          {state === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-950 text-white">
              <span className="text-xs font-bold uppercase tracking-[0.18em]">
                Loading 360 viewer
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(120deg,#071f34_0%,#183d5d_46%,#d9c7a5_100%)]">
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/20" />
          <div className="absolute left-[12%] top-[22%] h-20 w-28 rounded-full border border-white/20" />
          <div className="absolute right-[16%] bottom-[20%] h-24 w-36 rounded-full border border-white/15" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(4,16,28,0.28)_75%)]" />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-white">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] backdrop-blur">
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
            360 viewer
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            {hasViewer ? "Drag to look around" : "Upload a Service hero panorama"}
          </span>
        </div>
      </div>
    </div>
  );
}
