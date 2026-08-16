import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  OptimizedImage,
  type OptimizedImageProps,
} from "@/components/media/OptimizedImage";

type ContainedImageStyle = Omit<
  CSSProperties,
  "objectFit" | "objectPosition"
>;

export interface StaticImageStageProps
  extends Omit<
    OptimizedImageProps,
    "className" | "fill" | "style"
  > {
  stageClassName?: string;
  imageClassName?: string;
  imageStyle?: ContainedImageStyle;
  showImage?: boolean;
  children?: ReactNode;
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
  stageClassName,
  imageClassName,
  imageStyle,
  showImage = true,
  children,
  ...imageProps
}: StaticImageStageProps) {
  return (
    <div
      data-static-image-stage
      className={cn(
        "relative min-h-0 min-w-0 overflow-hidden bg-stone-950",
        stageClassName,
      )}
    >
      {showImage ? (
        <OptimizedImage
          {...imageProps}
          fill
          style={{
            ...imageStyle,
            objectFit: "contain",
            objectPosition: "center",
          }}
          className={cn(imageClassName, "object-contain object-center")}
          data-static-image-viewer-image
        />
      ) : null}
      {children}
    </div>
  );
}
