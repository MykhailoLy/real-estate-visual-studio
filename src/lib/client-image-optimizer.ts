"use client";

import {
  IMAGE_PROFILE_SETTINGS,
  type ClientImageProfile,
  type ImageProfileSettings,
} from "./image-profile-settings.ts";

export {
  IMAGE_PROFILE_SETTINGS,
  STANDARD_PUBLIC_IMAGE_PROFILE,
  type ClientImageProfile,
  type ImageProfileSettings,
} from "./image-profile-settings.ts";

export interface OptimizedClientImage {
  file: File;
  originalBytes: number;
  optimizedBytes: number;
  width: number;
  height: number;
  savedBytes: number;
  savedPercent: number;
}

export interface ImageOptimizationSummary {
  originalBytes: number;
  optimizedBytes: number;
  savedBytes: number;
  savedPercent: number;
}

const MAX_SOURCE_PIXELS = 100_000_000;

function outputName(filename: string, profile: ClientImageProfile): string {
  const stem =
    filename
      .replace(/\.[^.]+$/, "")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "") || "property-image";
  return `${stem}-${profile}.webp`;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("This browser could not optimize the image."));
      },
      "image/webp",
      quality,
    );
  });
}

async function loadImage(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  await image.decode();
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
}

function scaledDimensions(
  width: number,
  height: number,
  maxLongSide: number,
): { width: number; height: number } {
  const longSide = Math.max(width, height);
  if (longSide <= maxLongSide) return { width, height };
  const scale = maxLongSide / longSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function drawImage(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("This browser could not prepare the image.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

async function encodeBestWebp(
  source: CanvasImageSource,
  originalWidth: number,
  originalHeight: number,
  settings: ImageProfileSettings,
): Promise<{ blob: Blob; width: number; height: number }> {
  let maxLongSide = Math.min(
    Math.max(originalWidth, originalHeight),
    settings.maxLongSide,
  );
  let best: { blob: Blob; width: number; height: number } | null = null;

  for (let resizePass = 0; resizePass < 4; resizePass += 1) {
    const dimensions = scaledDimensions(originalWidth, originalHeight, maxLongSide);
    const canvas = drawImage(source, dimensions.width, dimensions.height);
    const qualitySteps = [
      settings.initialQuality,
      Math.max(settings.minimumQuality, settings.initialQuality - 0.06),
      Math.max(settings.minimumQuality, settings.initialQuality - 0.12),
      settings.minimumQuality,
    ];

    for (const quality of [...new Set(qualitySteps)]) {
      const blob = await canvasToBlob(canvas, quality);
      if (!best || blob.size < best.blob.size) {
        best = { blob, width: dimensions.width, height: dimensions.height };
      }
      if (blob.size <= settings.targetBytes) {
        canvas.width = 1;
        canvas.height = 1;
        return { blob, width: dimensions.width, height: dimensions.height };
      }
    }

    canvas.width = 1;
    canvas.height = 1;
    if (maxLongSide <= settings.minLongSide) break;
    maxLongSide = Math.max(settings.minLongSide, Math.round(maxLongSide * 0.85));
  }

  if (!best) throw new Error("This image could not be optimized.");
  return best;
}

export async function optimizeClientImage(
  file: File,
  profile: ClientImageProfile,
): Promise<OptimizedClientImage> {
  const settings = IMAGE_PROFILE_SETTINGS[profile];
  const decoded = await loadImage(file);

  try {
    if (decoded.width <= 0 || decoded.height <= 0) {
      throw new Error(`${file.name} has invalid dimensions.`);
    }
    if (decoded.width * decoded.height > MAX_SOURCE_PIXELS) {
      throw new Error(`${file.name} is too large to process safely in the browser.`);
    }

    const encoded = await encodeBestWebp(
      decoded.source,
      decoded.width,
      decoded.height,
      settings,
    );
    const optimizedFile = new File(
      [encoded.blob],
      outputName(file.name, profile),
      {
        type: "image/webp",
        lastModified: Date.now(),
      },
    );
    const savedBytes = Math.max(0, file.size - optimizedFile.size);
    const savedPercent =
      file.size > 0 ? Math.round((savedBytes / file.size) * 100) : 0;

    return {
      file: optimizedFile,
      originalBytes: file.size,
      optimizedBytes: optimizedFile.size,
      width: encoded.width,
      height: encoded.height,
      savedBytes,
      savedPercent,
    };
  } finally {
    decoded.cleanup();
  }
}

export function summarizeImageOptimizations(
  images: readonly Pick<
    OptimizedClientImage,
    "originalBytes" | "optimizedBytes"
  >[],
): ImageOptimizationSummary {
  const originalBytes = images.reduce(
    (total, image) => total + image.originalBytes,
    0,
  );
  const optimizedBytes = images.reduce(
    (total, image) => total + image.optimizedBytes,
    0,
  );
  const savedBytes = Math.max(0, originalBytes - optimizedBytes);
  const savedPercent =
    originalBytes > 0 ? Math.round((savedBytes / originalBytes) * 100) : 0;

  return { originalBytes, optimizedBytes, savedBytes, savedPercent };
}

export function formatImageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024)
    return `${kilobytes.toFixed(kilobytes >= 100 ? 0 : 1)} KB`;
  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(megabytes >= 10 ? 1 : 2)} MB`;
}

export function formatImageOptimizationSummary(
  summary: ImageOptimizationSummary,
): string {
  return `Original total: ${formatImageBytes(summary.originalBytes)} → uploaded: ${formatImageBytes(summary.optimizedBytes)} (${summary.savedPercent}% saved)`;
}
