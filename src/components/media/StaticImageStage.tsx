"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ImgHTMLAttributes,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { cn } from "@/lib/utils";
import {
  OptimizedImage,
  type OptimizedImageProps,
} from "@/components/media/OptimizedImage";
import {
  getContainedSurfaceGeometry,
  type StaticImageSize,
  type StaticImageViewerVariant,
} from "@/components/media/static-image-variant";

type ContainedImageStyle = Omit<
  CSSProperties,
  "objectFit" | "objectPosition"
>;

export interface StaticImageStageProps
  extends Omit<
    OptimizedImageProps,
    "className" | "fill" | "style"
  > {
  variant: StaticImageViewerVariant;
  stageClassName?: string;
  imageClassName?: string;
  imageStyle?: ContainedImageStyle;
  showImage?: boolean;
  children?: ReactNode;
}

interface NativeStaticImageStageProps
  extends Omit<
    ImgHTMLAttributes<HTMLImageElement>,
    "alt" | "className" | "height" | "style" | "width"
  > {
  alt: string;
  variant: StaticImageViewerVariant;
  stageClassName?: string;
  imageClassName?: string;
  imageStyle?: ContainedImageStyle;
  showImage?: boolean;
  children?: ReactNode;
}

interface StaticImageFrameProps {
  variant: StaticImageViewerVariant;
  stageClassName?: string;
  imageClassName?: string;
  imageStyle?: ContainedImageStyle;
  showImage: boolean;
  children?: ReactNode;
  renderImage: (props: {
    className: string;
    style: CSSProperties;
    onLoad: (event: SyntheticEvent<HTMLImageElement>) => void;
  }) => ReactNode;
}

function StaticImageFrame({
  variant,
  stageClassName,
  imageClassName,
  imageStyle,
  showImage,
  children,
  renderImage,
}: StaticImageFrameProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<StaticImageSize>({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState<StaticImageSize | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateSize = () => {
      const rect = stage.getBoundingClientRect();
      setStageSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const handleLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
    }
  }, []);

  const geometry =
    naturalSize && stageSize.width > 0 && stageSize.height > 0
      ? getContainedSurfaceGeometry(stageSize, naturalSize, variant)
      : null;

  return (
    <div
      ref={stageRef}
      data-static-image-stage
      data-static-image-variant={variant}
      className={cn(
        "relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden bg-transparent",
        stageClassName,
      )}
    >
      {showImage ? (
        <div
          data-static-image-surface
          data-static-image-ready={geometry ? "true" : "false"}
          className={cn(
            "relative flex shrink-0 items-center justify-center overflow-hidden",
            variant === "plan" && "bg-white shadow-2xl ring-1 ring-black/10",
          )}
          style={
            geometry
              ? {
                  width: geometry.surfaceWidth,
                  height: geometry.surfaceHeight,
                  padding: geometry.padding,
                }
              : { width: "100%", height: "100%", opacity: 0 }
          }
        >
          <div
            className="relative shrink-0"
            style={
              geometry
                ? { width: geometry.imageWidth, height: geometry.imageHeight }
                : { width: "100%", height: "100%" }
            }
          >
            {renderImage({
              className: cn(
                imageClassName,
                "h-full w-full object-contain object-center",
              ),
              style: {
                ...imageStyle,
                objectFit: "contain",
                objectPosition: "center",
              },
              onLoad: handleLoad,
            })}
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}

/**
 * Shared stage for primary static images inside expanded viewers.
 *
 * The stage deliberately owns object-fit and object-position so individual
 * galleries cannot accidentally turn the expanded image back into a cropped
 * card thumbnail. Callers remain responsible for giving the stage both a
 * width and a height within their viewer chrome.
 */
export default function StaticImageStage({
  variant,
  stageClassName,
  imageClassName,
  imageStyle,
  showImage = true,
  children,
  alt,
  onLoad,
  ...imageProps
}: StaticImageStageProps) {
  return (
    <StaticImageFrame
      variant={variant}
      stageClassName={stageClassName}
      imageClassName={imageClassName}
      imageStyle={imageStyle}
      showImage={showImage}
      renderImage={({ className, style, onLoad: captureNaturalSize }) => (
        <OptimizedImage
          {...imageProps}
          alt={alt}
          fill
          style={style}
          className={className}
          onLoad={(event) => {
            captureNaturalSize(event);
            onLoad?.(event);
          }}
          data-static-image-viewer-image
        />
      )}
    >
      {children}
    </StaticImageFrame>
  );
}

/** Shared viewer stage for private, blob, and signed URLs that bypass next/image. */
export function NativeStaticImageStage({
  variant,
  stageClassName,
  imageClassName,
  imageStyle,
  showImage = true,
  children,
  alt,
  onLoad,
  ...imageProps
}: NativeStaticImageStageProps) {
  return (
    <StaticImageFrame
      variant={variant}
      stageClassName={stageClassName}
      imageClassName={imageClassName}
      imageStyle={imageStyle}
      showImage={showImage}
      renderImage={({ className, style, onLoad: captureNaturalSize }) => (
        // Private signed URLs and local blob URLs intentionally bypass next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          {...imageProps}
          alt={alt}
          className={className}
          style={style}
          onLoad={(event) => {
            captureNaturalSize(event);
            onLoad?.(event);
          }}
          data-static-image-viewer-image
        />
      )}
    >
      {children}
    </StaticImageFrame>
  );
}
