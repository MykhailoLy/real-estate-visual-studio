"use client";

import "@photo-sphere-viewer/core/index.css";
import { useEffect, useRef, useState } from "react";
import { ComparisonHeroFooter } from "@/components/media/ComparisonHeroChrome";
import type { PortfolioServiceSlug } from "@/lib/portfolio-service-meta";
import {
  getHeroServicePresentation,
  type RemoteServiceLocale,
} from "@/lib/pricing/remote-service-presentation";
import { cn } from "@/lib/utils";
import type { Viewer as PhotoSphereViewer } from "@photo-sphere-viewer/core";
import type { RefObject } from "react";

interface SyncedPanoramaCompareViewerProps {
  beforeImageUrl: string;
  afterImageUrl: string;
  beforeTitle: string;
  afterTitle: string;
  fallbackLabel: string;
  serviceSlug: PortfolioServiceSlug;
  locale: RemoteServiceLocale;
  orderHref: string;
  orderLabel: string;
}

const AUTO_ROTATE_RADIANS_PER_SECOND = 0.03;
const RESUME_AUTO_ROTATE_AFTER_MS = 2_600;
const DEFAULT_ZOOM = 30;

type ViewerStatus = "loading" | "ready" | "fallback";
type ViewerSide = "before" | "after";

export default function SyncedPanoramaCompareViewer({
  beforeImageUrl,
  afterImageUrl,
  beforeTitle,
  afterTitle,
  fallbackLabel,
  serviceSlug,
  locale,
  orderHref,
  orderLabel,
}: SyncedPanoramaCompareViewerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const beforeContainerRef = useRef<HTMLDivElement | null>(null);
  const afterContainerRef = useRef<HTMLDivElement | null>(null);
  const beforeViewerRef = useRef<PhotoSphereViewer | null>(null);
  const afterViewerRef = useRef<PhotoSphereViewer | null>(null);
  const frameRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const syncingRef = useRef(false);
  const activeSideRef = useRef<ViewerSide>("before");
  const autoRotateRef = useRef(false);
  const lastFrameRef = useRef(0);
  const readyCountRef = useRef(0);
  const [status, setStatus] = useState<ViewerStatus>("loading");

  useEffect(() => {
    const beforeNode = beforeContainerRef.current;
    const afterNode = afterContainerRef.current;
    if (!beforeImageUrl || !afterImageUrl || !beforeNode || !afterNode) return;

    let cancelled = false;
    let beforeViewer: PhotoSphereViewer | null = null;
    let afterViewer: PhotoSphereViewer | null = null;

    const clearResumeTimer = () => {
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
    };

    const stopFrameLoop = () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };

    const setProgrammatic = () => {
      syncingRef.current = true;
      window.setTimeout(() => {
        syncingRef.current = false;
      }, 0);
    };

    const syncFrom = (side: ViewerSide) => {
      if (syncingRef.current) return;
      const source =
        side === "before" ? beforeViewerRef.current : afterViewerRef.current;
      const target =
        side === "before" ? afterViewerRef.current : beforeViewerRef.current;
      if (!source || !target) return;

      setProgrammatic();
      const position = source.getPosition();
      target.rotate({ yaw: position.yaw, pitch: position.pitch });
      target.zoom(source.getZoomLevel());
      activeSideRef.current = side;
    };

    const resumeAutoRotate = () => {
      clearResumeTimer();
      resumeTimerRef.current = window.setTimeout(() => {
        if (!cancelled && beforeViewerRef.current && afterViewerRef.current) {
          autoRotateRef.current = true;
        }
      }, RESUME_AUTO_ROTATE_AFTER_MS);
    };

    const pauseAutoRotate = () => {
      autoRotateRef.current = false;
      resumeAutoRotate();
    };

    const bindInteraction = (node: HTMLDivElement, side: ViewerSide) => {
      const start = () => {
        activeSideRef.current = side;
        pauseAutoRotate();
      };
      const wheel = () => {
        activeSideRef.current = side;
        pauseAutoRotate();
      };
      node.addEventListener("pointerdown", start);
      node.addEventListener("touchstart", start, { passive: true });
      node.addEventListener("wheel", wheel, { passive: true });
      return () => {
        node.removeEventListener("pointerdown", start);
        node.removeEventListener("touchstart", start);
        node.removeEventListener("wheel", wheel);
      };
    };

    const markReady = () => {
      readyCountRef.current += 1;
      if (!cancelled && readyCountRef.current >= 2) {
        setStatus("ready");
        autoRotateRef.current = true;
      }
    };

    const markFallback = () => {
      if (!cancelled) {
        autoRotateRef.current = false;
        setStatus("fallback");
      }
    };

    const renderLoop = (now: number) => {
      const before = beforeViewerRef.current;
      const after = afterViewerRef.current;
      if (before && after) {
        const master = activeSideRef.current === "after" ? after : before;
        const current = master.getPosition();
        const zoom = master.getZoomLevel();

        if (autoRotateRef.current && lastFrameRef.current > 0) {
          const deltaSeconds = Math.min((now - lastFrameRef.current) / 1000, 0.08);
          const next = {
            yaw: current.yaw + AUTO_ROTATE_RADIANS_PER_SECOND * deltaSeconds,
            pitch: current.pitch,
          };
          setProgrammatic();
          before.rotate(next);
          after.rotate(next);
          before.zoom(zoom);
          after.zoom(zoom);
          if (rootRef.current) {
            rootRef.current.dataset.panoramaYaw = next.yaw.toFixed(4);
          }
        } else {
          if (rootRef.current) {
            rootRef.current.dataset.panoramaYaw = current.yaw.toFixed(4);
          }
        }
      }

      lastFrameRef.current = now;
      frameRef.current = window.requestAnimationFrame(renderLoop);
    };

    async function mountViewers() {
      try {
        const { Viewer } = await import("@photo-sphere-viewer/core");
        if (cancelled || !beforeContainerRef.current || !afterContainerRef.current) {
          return;
        }

        beforeContainerRef.current.innerHTML = "";
        afterContainerRef.current.innerHTML = "";

        const shared = {
          navbar: false,
          mousewheel: true,
          keyboard: false,
          touchmoveTwoFingers: false,
          defaultYaw: 0,
          defaultPitch: 0,
          defaultZoomLvl: DEFAULT_ZOOM,
          minFov: 50,
          maxFov: 90,
          moveSpeed: 1.15,
          zoomSpeed: 0.7,
          moveInertia: 0.72,
          canvasBackground: "#0f172a",
          loadingTxt: "Loading 360 viewer",
        };

        beforeViewer = new Viewer({
          ...shared,
          container: beforeContainerRef.current,
          panorama: beforeImageUrl,
        });
        afterViewer = new Viewer({
          ...shared,
          container: afterContainerRef.current,
          panorama: afterImageUrl,
        });

        beforeViewerRef.current = beforeViewer;
        afterViewerRef.current = afterViewer;

        beforeViewer.addEventListener("ready", markReady);
        afterViewer.addEventListener("ready", markReady);
        beforeViewer.addEventListener("panorama-error", markFallback);
        afterViewer.addEventListener("panorama-error", markFallback);
        beforeViewer.addEventListener("position-updated", () => syncFrom("before"));
        afterViewer.addEventListener("position-updated", () => syncFrom("after"));
        beforeViewer.addEventListener("zoom-updated", () => syncFrom("before"));
        afterViewer.addEventListener("zoom-updated", () => syncFrom("after"));

        stopFrameLoop();
        frameRef.current = window.requestAnimationFrame(renderLoop);
      } catch {
        markFallback();
      }
    }

    readyCountRef.current = 0;
    autoRotateRef.current = false;
    lastFrameRef.current = 0;
    setStatus("loading");
    mountViewers();

    const unbindBefore = bindInteraction(beforeNode, "before");
    const unbindAfter = bindInteraction(afterNode, "after");
    window.addEventListener("pointerup", resumeAutoRotate);
    window.addEventListener("pointercancel", resumeAutoRotate);
    window.addEventListener("touchend", resumeAutoRotate);
    window.addEventListener("touchcancel", resumeAutoRotate);
    window.addEventListener("resize", resumeAutoRotate);

    return () => {
      cancelled = true;
      clearResumeTimer();
      stopFrameLoop();
      unbindBefore();
      unbindAfter();
      window.removeEventListener("pointerup", resumeAutoRotate);
      window.removeEventListener("pointercancel", resumeAutoRotate);
      window.removeEventListener("touchend", resumeAutoRotate);
      window.removeEventListener("touchcancel", resumeAutoRotate);
      window.removeEventListener("resize", resumeAutoRotate);
      beforeViewer?.destroy();
      afterViewer?.destroy();
      if (beforeViewerRef.current === beforeViewer) beforeViewerRef.current = null;
      if (afterViewerRef.current === afterViewer) afterViewerRef.current = null;
    };
  }, [afterImageUrl, beforeImageUrl]);

  const hasViewer = status === "loading" || status === "ready";
  const service = getHeroServicePresentation(serviceSlug, locale);

  return (
    <div
      ref={rootRef}
      className={cn(
        "w-full max-w-full overflow-hidden rounded-xl lg:rounded-2xl shadow-xl ring-1 ring-black/10",
        hasViewer ? "bg-stone-950" : "bg-primary"
      )}
      data-panorama-state={status}
      data-panorama-viewer="photo-sphere-viewer-synced-compare"
      role="group"
      aria-label={hasViewer ? "Synchronized 360 before and after comparison" : fallbackLabel}
    >
      <div className="relative w-full overflow-hidden">
        {hasViewer ? (
          <div className="grid w-full min-w-0 grid-cols-1 gap-px bg-white/15 md:grid-cols-2">
            <PanoramaPane
              title={beforeTitle}
              containerRef={beforeContainerRef}
            />
            <PanoramaPane
              title={afterTitle}
              containerRef={afterContainerRef}
            />
          </div>
        ) : (
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-[linear-gradient(120deg,#071f34_0%,#183d5d_46%,#d9c7a5_100%)] md:aspect-[32/9]">
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/20" />
            <div className="absolute left-[12%] top-[22%] h-20 w-28 rounded-full border border-white/20" />
            <div className="absolute right-[16%] bottom-[20%] h-24 w-36 rounded-full border border-white/15" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(4,16,28,0.28)_75%)]" />
          </div>
        )}

        {status === "loading" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stone-950/65 text-white">
            <span className="text-xs font-bold uppercase tracking-[0.18em]">
              Loading 360 comparison
            </span>
          </div>
        )}
      </div>

      <ComparisonHeroFooter
        service={service}
        locale={locale}
        ctaHref={orderHref}
        ctaLabel={orderLabel}
        analyticsLocation="service_hero"
        analyticsEvent="order_intent"
        comparisonLabelsAriaHidden
      />
    </div>
  );
}

function PanoramaPane({
  title,
  containerRef,
}: {
  title: string;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden bg-stone-950">
      <div
        ref={containerRef}
        className="aspect-[16/9] w-full min-w-0 touch-none [&_.psv-canvas-container]:!h-full [&_.psv-canvas-container]:!w-full [&_.psv-container]:!h-full [&_.psv-container]:!w-full [&_.psv-container]:!bg-stone-950 [&_.psv-container]:!font-sans"
        role="img"
        aria-label={title}
      />
    </div>
  );
}
