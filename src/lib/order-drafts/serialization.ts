import type { JsonObject, JsonValue } from "./types.ts";

export class JsonNormalizationError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "JsonNormalizationError";
    this.path = path;
  }
}

function formatPath(parent: string, key: string | number): string {
  if (typeof key === "number") return `${parent}[${key}]`;
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) return `${parent}.${key}`;
  return `${parent}[${JSON.stringify(key)}]`;
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function runtimeName(value: unknown): string {
  return Object.prototype.toString.call(value).slice(8, -1);
}

function isRuntimeFileOrBlob(value: object): boolean {
  const fileConstructor = globalThis.File;
  const blobConstructor = globalThis.Blob;
  return (
    (typeof fileConstructor === "function" && value instanceof fileConstructor) ||
    (typeof blobConstructor === "function" && value instanceof blobConstructor)
  );
}

function normalize(value: unknown, path: string, seen: WeakSet<object>): JsonValue {
  if (value === null) return null;

  if (typeof value === "string" || typeof value === "boolean") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new JsonNormalizationError(path, "number must be finite");
    }
    return value;
  }

  if (typeof value === "undefined") {
    throw new JsonNormalizationError(path, "undefined is not valid JSON");
  }

  if (
    typeof value === "bigint" ||
    typeof value === "symbol" ||
    typeof value === "function"
  ) {
    throw new JsonNormalizationError(path, `${typeof value} is not JSON-safe`);
  }

  if (typeof value !== "object") {
    throw new JsonNormalizationError(path, "value is not JSON-safe");
  }

  if (seen.has(value)) {
    throw new JsonNormalizationError(path, "circular reference is not JSON-safe");
  }

  if (
    value instanceof Date ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    isRuntimeFileOrBlob(value)
  ) {
    throw new JsonNormalizationError(path, `${runtimeName(value)} is not JSON-safe`);
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const normalized = value.map((item, index) => {
      if (typeof item === "undefined") {
        throw new JsonNormalizationError(
          formatPath(path, index),
          "undefined array entries are not JSON-safe",
        );
      }
      return normalize(item, formatPath(path, index), seen);
    });
    seen.delete(value);
    return normalized;
  }

  if (!isPlainObject(value)) {
    throw new JsonNormalizationError(path, `${runtimeName(value)} is not a plain object`);
  }

  const normalized: JsonObject = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "undefined") continue;
    normalized[key] = normalize(item, formatPath(path, key), seen);
  }

  seen.delete(value);
  return normalized;
}

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    const sorted: JsonObject = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortJson(value[key]);
    }
    return sorted;
  }
  return value;
}

export function normalizeJsonValue(value: unknown): JsonValue {
  return normalize(value, "$", new WeakSet<object>());
}

export function stableStringifyJson(value: unknown): string {
  return JSON.stringify(sortJson(normalizeJsonValue(value)));
}
