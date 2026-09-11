export const DOCUMENT_LANGUAGE_HEADER = "x-picchuspot-document-language";

export type DocumentLanguage = "en" | "es";

export function getDocumentLanguage(pathname: string): DocumentLanguage {
  const path = pathname.split(/[?#]/, 1)[0];
  return path === "/es" || path.startsWith("/es/") ? "es" : "en";
}

export function parseDocumentLanguage(
  value: string | null | undefined,
): DocumentLanguage {
  return value === "es" ? "es" : "en";
}
