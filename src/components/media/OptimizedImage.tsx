import Image, { type ImageProps } from "next/image";
import {
  getOptimizedImageDelivery,
  type OptimizedImageContext,
} from "./image-delivery";

type OptimizedImageProps = Omit<ImageProps, "quality" | "sizes"> & {
  context: OptimizedImageContext;
};

/**
 * Standard delivery component for public raster media. `sizes` and quality
 * intentionally come from a named context so property and portfolio surfaces
 * always use the same Next.js optimization policy.
 */
export function OptimizedImage({
  context,
  alt,
  ...props
}: OptimizedImageProps) {
  const delivery = getOptimizedImageDelivery(context);

  return (
    <Image
      {...props}
      alt={alt}
      sizes={delivery.sizes}
      quality={delivery.quality}
    />
  );
}

/**
 * Preloads exactly one already-authorized next image through `/_next/image`.
 * It is mounted only after the visible frame has loaded; never pass a whole
 * gallery to this component.
 */
export function OptimizedImagePreloader({
  src,
  context,
}: Pick<ImageProps, "src"> & {
  context: OptimizedImageContext;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
    >
      <OptimizedImage
        src={src}
        alt=""
        context={context}
        fill
        loading="eager"
        fetchPriority="low"
      />
    </div>
  );
}
