"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export interface PropertyHeroSlide {
  imageUrl: string;
  imageAlt: string;
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
    if (images.length < 2) return;
    const nextImage = new window.Image();
    nextImage.src = images[(activeIndex + 1) % images.length].imageUrl;
  }, [activeIndex, images]);

  useEffect(() => {
    if (!canRotate || previousIndex !== null) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const rotate = () => {
      setIsFading(false);
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
        <Image
          src={previousSlide.imageUrl}
          alt=""
          fill
          sizes="100vw"
          className={`object-cover transition-opacity duration-[1500ms] ease-in-out ${
            isFading ? "opacity-0" : "opacity-100"
          }`}
        />
      ) : null}
      <Image
        src={activeSlide.imageUrl}
        alt=""
        fill
        preload={activeIndex === 0}
        sizes="100vw"
        className={`object-cover transition-opacity duration-[1500ms] ease-in-out ${
          previousSlide && !isFading ? "opacity-0" : "opacity-100"
        }`}
      />
    </div>
  );
}
