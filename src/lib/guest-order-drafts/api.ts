import { guestDraftsEnabled } from "./entry.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ORDER_DRAFT_API_MAX_BODY_BYTES } from "../order-drafts/api.ts";
import { OrderDraftStatusSchema, TransactionalCurrencySchema, UuidSchema } from "../order-drafts/schema.ts";
import {
  buildGuestState,
  ClaimInput,
  CreateInput,
  GUEST_DRAFT_SIZE_ERROR,
  guestQuote,
  GuestState,
  SaveInput,
} from "./schema.ts";
import { checkRateLimit, newToken, readToken, sameOrigin, setToken, tokenHash } from "./security.ts";

type Operation = "get" | "save" | "claim" | "new";
interface Dependencies {
  db: () => SupabaseClient;
  user: () => Promise<{ id: string } | null>;
  limit: typeof checkRateLimit;
}
const status = {
  invalid_input: 400,
  unauthenticated: 401,
  guest_draft_unauthenticated: 401,
  forbidden_origin: 403,
  not_found: 404,
  version_conflict: 409,
  guest_draft_claimed: 409,
  guest_draft_context_mismatch: 409,
  guest_draft_expired: 410,
  invalid_service: 422,
  invalid_route: 422,
  invalid_state: 422,
  rate_limited: 429,
  database_error: 500,
  unexpected_error: 500,
  guest_drafts_unavailable: 503,
  guest_drafts_misconfigured: 503,
  write_outcome_unknown: 503,
} as const;
const headers = { "Cache-Control": "no-store", Vary: "Cookie" };
function failure(
  code: keyof typeof status,
  details?: { claimed?: true; outcome?: "rolled_back" | "unknown"; message?: string },
  retry?: number,
) {
  return Response.json(
    { code, ...details },
    { status: status[code], headers: retry ? { ...headers, "Retry-After": String(retry) } : headers },
  );
}
const unknown = () => failure("write_outcome_unknown", { outcome: "unknown" }, 30);

// Positive evidence of failure of THIS statement only. In particular, 08007,
// 40003, gateway errors and transport exceptions cannot establish rollback.
function writeError(code?: string) {
  if (
    code &&
    (/^23[0-9A-Z]{3}$/.test(code) || ["40001", "40P01", "P0001", "P0002", "57014"].includes(code))
  ) {
    return failure("database_error", { outcome: "rolled_back" });
  }
  return unknown();
}

const bodyTooLarge = Symbol("bodyTooLarge");
async function readBody(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" ||
    !request.body
  )
    return null;
  if (Number(request.headers.get("content-length")) > ORDER_DRAFT_API_MAX_BODY_BYTES) return bodyTooLarge;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > ORDER_DRAFT_API_MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        return bodyTooLarge;
      }
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, bytes)));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

const expiry = z.iso.datetime({ offset: true });
const savedRow = z.object({
  id: UuidSchema,
  state: GuestState,
  version: z.int().positive(),
  currency: TransactionalCurrencySchema,
  expires_at: expiry,
});
const columns = "id,state,version,currency,updated_at,expires_at";
function configuration(row: z.infer<typeof savedRow>, quote = guestQuote(row.state, row.currency)) {
  return {
    guestDraftId: row.id,
    version: row.version,
    currency: row.currency,
    state: row.state,
    expiresAt: row.expires_at,
    quote,
  };
}

async function limitWrite(
  deps: Dependencies,
  request: Request,
  action: "save" | "claim" | "new" | "user",
  secret: string,
  id?: string,
) {
  try {
    const retry = await deps.limit(request, action, secret, id);
    return retry ? failure("rate_limited", undefined, retry) : null;
  } catch {
    return failure("guest_drafts_unavailable", undefined, 30);
  }
}

async function getDraft(deps: Dependencies, hash: string) {
  const db = deps.db();
  const { data, error } = await db
    .from("guest_order_drafts")
    .select(columns + ",claimed_by,claimed_draft_id")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error) return failure("database_error");
  if (!data) return failure("not_found");
  const row = z
    .object({
      id: UuidSchema,
      claimed_by: UuidSchema.nullable(),
      claimed_draft_id: UuidSchema.nullable(),
      expires_at: expiry,
    })
    .parse(data);
  if (row.claimed_by !== null) {
    const user = await deps.user();
    if (!user) return failure("unauthenticated", { claimed: true });
    if (row.claimed_by !== user.id || !row.claimed_draft_id) return failure("not_found");
    const { data: draft, error } = await db
      .from("order_drafts")
      .select("id,version,status")
      .eq("id", row.claimed_draft_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return failure("database_error");
    if (!draft) return failure("not_found");
    return Response.json(
      {
        claimed: true,
        guestDraftId: row.id,
        draftId: draft.id,
        draftVersion: draft.version,
        draftStatus: draft.status,
      },
      { headers },
    );
  }
  if (Date.parse(row.expires_at) <= Date.now()) return failure("guest_draft_expired");
  const parsed = savedRow.safeParse(data);
  return parsed.success
    ? Response.json({ claimed: false, ...configuration(parsed.data) }, { headers })
    : failure("invalid_state");
}

async function classifyMiss(db: SupabaseClient, hash: string, input: ClaimInput) {
  const { data, error } = await db
    .from("guest_order_drafts")
    .select("id,claimed_by,expires_at,version")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error) return failure("database_error");
  if (!data) return failure("not_found");
  if (data.claimed_by !== null) return failure("guest_draft_claimed");
  if (data.id !== input.guestDraftId) return failure("guest_draft_context_mismatch");
  if (Date.parse(data.expires_at) <= Date.now()) return failure("guest_draft_expired");
  if (data.version !== input.expectedVersion) return failure("version_conflict");
  return failure("database_error");
}

async function saveDraft(
  deps: Dependencies,
  request: Request,
  body: unknown,
  secret: string,
  fresh: boolean,
) {
  const parsed = (fresh ? CreateInput : SaveInput).safeParse(body);
  if (!parsed.success) {
    const overBudget = parsed.error.issues.some((issue) => issue.message === GUEST_DRAFT_SIZE_ERROR);
    return failure("invalid_input", overBudget ? { message: GUEST_DRAFT_SIZE_ERROR } : undefined);
  }
  const { guestDraftId, expectedVersion }: z.infer<typeof SaveInput> = parsed.data;
  const context =
    guestDraftId !== undefined && expectedVersion !== undefined ? { guestDraftId, expectedVersion } : null;
  const current = fresh ? undefined : readToken(request, secret);
  if (current === null) return failure("guest_draft_unauthenticated");
  if (current === undefined && (guestDraftId !== undefined || expectedVersion !== undefined))
    return failure("invalid_input");
  if (current !== undefined && !context) return failure("invalid_input");

  const token = current ?? newToken();
  const hash = tokenHash(token);
  const state = buildGuestState(parsed.data.draft);
  const currency = parsed.data.currency;
  const quote = guestQuote(state, currency);
  const db = deps.db();
  try {
    const updating = current !== undefined && context !== null;
    const result = updating
      ? await db
          .rpc("save_guest_order_draft", {
            p_token_hash: hash,
            p_state: state,
            p_currency: currency,
            p_expected_version: context.expectedVersion,
            p_expected_draft_id: context.guestDraftId,
          })
          .select(columns)
          .maybeSingle()
      : await db
          .from("guest_order_drafts")
          .insert({ token_hash: hash, state, currency })
          .select(columns)
          .single();
    if (result.error) return writeError(result.error.code);
    if (!result.data && updating) return await classifyMiss(db, hash, context);
    const row = savedRow.safeParse(result.data);
    if (!row.success) return unknown();
    const response = Response.json(configuration(row.data, quote), {
      status: updating ? 200 : 201,
      headers,
    });
    setToken(response, token, secret, row.data.expires_at);
    return response;
  } catch {
    return unknown();
  }
}

const rpcFailures = {
  not_found: "not_found",
  context_mismatch: "guest_draft_context_mismatch",
  expired: "guest_draft_expired",
  invalid_service: "invalid_service",
  invalid_route: "invalid_route",
  invalid_state: "invalid_state",
  version_conflict: "version_conflict",
} as const;
const claimResult = z.object({
  result_code: z.enum(["claimed", "already_claimed"]),
  draft_id: UuidSchema,
  draft_version: z.int().positive(),
  draft_status: OrderDraftStatusSchema,
  guest_expires_at: expiry,
});

async function claimDraft(deps: Dependencies, request: Request, body: unknown, secret: string) {
  const input = ClaimInput.safeParse(body);
  if (!input.success) return failure("invalid_input");
  const user = await deps.user();
  if (!user) return failure("unauthenticated");
  if (!UuidSchema.safeParse(user.id).success) return failure("unexpected_error");
  const denied = await limitWrite(deps, request, "user", secret, user.id);
  if (denied) return denied;
  const token = readToken(request, secret);
  if (!token) return failure("guest_draft_unauthenticated");
  const db = deps.db();
  try {
    const { data, error } = await db
      .rpc("claim_guest_order_draft", {
        p_user_id: user.id,
        p_token_hash: tokenHash(token),
        p_expected_draft_id: input.data.guestDraftId,
        p_expected_version: input.data.expectedVersion,
      })
      .single();
    if (error) return writeError(error.code);
    const failed = z
      .object({ result_code: z.enum(Object.keys(rpcFailures) as (keyof typeof rpcFailures)[]) })
      .safeParse(data);
    if (failed.success) return failure(rpcFailures[failed.data.result_code]);
    const parsed = claimResult.safeParse(data);
    if (!parsed.success) return unknown();
    const row = parsed.data;
    const response = Response.json(
      {
        guestDraftId: input.data.guestDraftId,
        draftId: row.draft_id,
        version: row.draft_version,
        status: row.draft_status,
        alreadyClaimed: row.result_code === "already_claimed",
        guestExpiresAt: row.guest_expires_at,
      },
      { headers },
    );
    setToken(response, token, secret, row.guest_expires_at);
    return response;
  } catch {
    return unknown();
  }
}

export async function guestDraftRequest(
  request: Request,
  operation: Operation,
  deps: Dependencies,
): Promise<Response> {
  if (!guestDraftsEnabled()) return failure("not_found");
  const secret = process.env.GUEST_DRAFT_COOKIE_SECRET?.trim();
  if (!secret || secret.length < 32) return failure("guest_drafts_misconfigured", undefined, 30);
  try {
    if (operation === "get") {
      const token = readToken(request, secret);
      return token ? await getDraft(deps, tokenHash(token)) : failure("guest_draft_unauthenticated");
    }
    if (!sameOrigin(request)) return failure("forbidden_origin");
    const denied = await limitWrite(deps, request, operation, secret);
    if (denied) return denied;
    const body = await readBody(request);
    if (body === bodyTooLarge) {
      return failure("invalid_input", {
        message: `The request body must be at most ${ORDER_DRAFT_API_MAX_BODY_BYTES} bytes.`,
      });
    }
    return operation === "claim"
      ? await claimDraft(deps, request, body, secret)
      : await saveDraft(deps, request, body, secret, operation === "new");
  } catch {
    return failure("unexpected_error");
  }
}
