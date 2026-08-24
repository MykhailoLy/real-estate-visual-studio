/**
 * Deterministic JSON used for submission intent and email payload hashes.
 * Object keys are sorted recursively; array order remains significant.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeCanonicalValue(value));
}

function normalizeCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeCanonicalValue);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .filter((key) => record[key] !== undefined)
        .map((key) => [key, normalizeCanonicalValue(record[key])]),
    );
  }
  return value;
}
