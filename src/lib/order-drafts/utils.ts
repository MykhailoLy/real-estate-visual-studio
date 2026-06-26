import type {
  DraftUpdateDataAccessOutcome,
  DraftUpdateResult,
} from "./types.ts";

export function createDraftClientItemId(): string {
  return crypto.randomUUID();
}

export function mapDraftUpdateOutcome<T>(
  outcome: DraftUpdateDataAccessOutcome<T>,
): DraftUpdateResult<T> {
  switch (outcome.kind) {
    case "updated":
      return {
        ok: true,
        draft: outcome.draft,
        version: outcome.version,
      };
    case "not_found_or_ownership_mismatch":
      return {
        ok: false,
        code: "not_found",
        message: "Draft was not found.",
        internalDiagnostic: "not_found",
      };
    case "version_conflict":
      return {
        ok: false,
        code: "version_conflict",
        message: "Draft has changed since it was loaded.",
        internalDiagnostic: "version_conflict",
      };
    case "invalid_status":
      return {
        ok: false,
        code: "invalid_status",
        message: `Draft cannot be updated from status '${outcome.status}'.`,
        internalDiagnostic: "invalid_status",
      };
    case "database_error":
      return {
        ok: false,
        code: "database_error",
        message: outcome.message,
        internalDiagnostic: "database_error",
      };
  }
}
