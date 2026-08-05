import { absoluteUrl } from "../../lib/seo.ts";

export interface PropertyShareData {
  title: string;
  text: string;
  url: string;
}

export function canonicalPropertyUrl(slug: string): string {
  return absoluteUrl(`/property/${encodeURIComponent(slug)}`);
}

export function propertyShareData(input: {
  slug: string;
  title: string;
  text: string;
}): PropertyShareData {
  return {
    title: input.title.trim(),
    text: input.text.trim(),
    url: canonicalPropertyUrl(input.slug),
  };
}
