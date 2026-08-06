import "server-only";
import { computePropertySocialImageVersion } from "./social-image-version.ts";
import type { PropertyShowcase } from "./types.ts";

export function getPropertySocialImageVersion(
  property: PropertyShowcase,
): string {
  return computePropertySocialImageVersion(property);
}
