export const STANDARD_PUBLIC_IMAGE_SLOTS = [
  "before",
  "after",
  "image",
  "poster",
] as const;

export type StandardPublicImageSlot =
  (typeof STANDARD_PUBLIC_IMAGE_SLOTS)[number];

export function usesStandardPublicImageProfile(
  slot: string,
): slot is StandardPublicImageSlot {
  return (STANDARD_PUBLIC_IMAGE_SLOTS as readonly string[]).includes(slot);
}
