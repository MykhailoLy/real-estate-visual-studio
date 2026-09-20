"use client";

import { useEffect, useState } from "react";
import {
  OptimizedImage,
  OptimizedImagePreloader,
} from "@/components/media/OptimizedImage";
import { focalPointToObjectPosition } from "@/features/property-showcase/focal-point";
import type { PropertyImageFocalPoint } from "@/features/property-showcase/types";

export interface PropertyHeroSlide {
  imageUrl: string;
  imageAlt: string;
  focalPoint?: PropertyImageFocalPoint;
}

interface PropertyHeroSlideshowProps {
  images: readonly PropertyHeroSlide[];
}

const ROTATION_INTERVAL_MS = 7000;
const FADE_DURATION_MS = 1500;

export default function PropertyHeroSlideshow({
  images,
}: PropertyHeroSlideshowProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [isFading, setIsFading] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [activeImageReady, setActiveImageReady] = useState(false);
  const [hasRotated, setHasRotated] = useState(false);
  const canRotate = images.length > 1 && !reducedMotion;
  const activeSlide = images[activeIndex] ?? images[0];
  const previousSlide = previousIndex === null ? undefined : images[previousIndex];

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(motionQuery.matches);
    updatePreference();
    motionQuery.addEventListener("change", updatePreference);
    return () => motionQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (!canRotate || previousIndex !== null) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const rotate = () => {
      setIsFading(false);
      setHasRotated(true);
      setActiveImageReady(false);
      setActiveIndex((currentIndex) => {
        setPreviousIndex(currentIndex);
        return (currentIndex + 1) % images.length;
      });
    };
    const scheduleRotation = () => {
      if (!document.hidden) timeoutId = setTimeout(rotate, ROTATION_INTERVAL_MS);
    };
    const handleVisibilityChange = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = undefined;
      scheduleRotation();
    };

    scheduleRotation();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [canRotate, images.length, previousIndex]);

  useEffect(() => {
    if (previousIndex === null) return;

    const animationFrame = requestAnimationFrame(() => setIsFading(true));
    const timeoutId = setTimeout(() => {
      setPreviousIndex(null);
      setIsFading(false);
    }, FADE_DURATION_MS);
    return () => {
      cancelAnimationFrame(animationFrame);
      clearTimeout(timeoutId);
    };
  }, [previousIndex]);

  if (!activeSlide) return null;

  return (
    <div data-testid="property-hero-slideshow" className="absolute inset-0" aria-hidden>
      {previousSlide ? (
        <OptimizedImage
          src={previousSlide.imageUrl}
          alt=""
          context="property-hero"
          fill
          style={{ objectPosition: focalPointToObjectPosition(previousSlide.focalPoint) }}
          className={`object-cover transition-opacity duration-[1500ms] ease-in-out ${
            isFading ? "opacity-0" : "opacity-100"
          }`}
        />
      ) : null}
      <OptimizedImage
        src={activeSlide.imageUrl}
        alt=""
        context="property-hero"
        fill
        preload={activeIndex === 0 && !hasRotated}
        onLoad={() => setActiveImageReady(true)}
        style={{ objectPosition: focalPointToObjectPosition(activeSlide.focalPoint) }}
        className={`object-cover transition-opacity duration-[1500ms] ease-in-out ${
          previousSlide && !isFading ? "opacity-0" : "opacity-100"
        }`}
      />
      {activeImageReady && images.length > 1 ? (
        <OptimizedImagePreloader
          src={images[(activeIndex + 1) % images.length].imageUrl}
          context="property-hero"
        />
      ) : null}
    </div>
  );
}
