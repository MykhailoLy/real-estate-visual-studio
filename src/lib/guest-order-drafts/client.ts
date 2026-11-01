import { formatMoney } from "../pricing/format.ts";
import { z } from "zod";
import { TransactionalCurrencySchema, UuidSchema } from "../order-drafts/schema.ts";
import {
  mapVirtualStagingFormToDraftState,
  type VirtualStagingFormDraftSource,
} from "../order-drafts/virtual-staging.ts";
import { GuestState, type ClaimInput } from "./schema.ts";

const saved = z.object({
  guestDraftId: UuidSchema,
  version: z.number().int().positive(),
  state: GuestState,
  currency: TransactionalCurrencySchema,
  expiresAt: z.string(),
  quote: z
    .object({
      nonAuthoritative: z.literal(true),
      preview: z.object({
        pricingVersion: z.string(),
        currency: TransactionalCurrencySchema,
        totalCents: z.number().int().nonnegative().nullable(),
        customQuote: z.boolean(),
        itemCount: z.number().int(),
      }),
    })
    .nullable(),
});
const claimed = z.object({ claimed: z.literal(true), guestDraftId: UuidSchema, draftId: UuidSchema });
export type GuestSaved = z.infer<typeof saved>;
export type GuestRead = GuestSaved | z.infer<typeof claimed>;

export class GuestRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly claimed: boolean;
  constructor(status: number, code: string, message?: string, claimed = false) {
    super(message ?? code);
    this.status = status;
    this.code = code;
    this.claimed = claimed;
  }
}

async function request<T>(path: string, method: string, schema: z.ZodType<T>, body?: unknown) {
  const response = await fetch("/api/guest-order-drafts" + path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const json = await response.json();
  if (!response.ok)
    throw new GuestRequestError(response.status, json.code, json.message, json.claimed === true);
  return schema.parse(json);
}

export function getGuestDraft() {
  return request("", "GET", z.union([claimed, saved]));
}
export function guestSaveBody(source: VirtualStagingFormDraftSource) {
  const { jobTitle, defaultFurnitureStyle, items } = mapVirtualStagingFormToDraftState(source);
  return {
    currency: source.currency,
    draft: {
      jobTitle,
      defaultFurnitureStyle,
      items: items.map(
        ({ clientItemId, state: { roomName, furnitureStyle, additionalInfo, selectedAddons } }) => ({
          clientItemId,
          state: { roomName, furnitureStyle, additionalInfo, selectedAddons },
        }),
      ),
    },
  };
}
export function saveGuestDraft(source: VirtualStagingFormDraftSource, context?: ClaimInput) {
  return request("", "PUT", saved, { ...guestSaveBody(source), ...context });
}
export function newGuestDraft(source: VirtualStagingFormDraftSource) {
  return request("/new", "POST", saved, guestSaveBody(source));
}
export function claimGuestDraft(snapshot: GuestSaved) {
  return request("/claim", "POST", z.object({ draftId: UuidSchema, alreadyClaimed: z.boolean() }), {
    guestDraftId: snapshot.guestDraftId,
    expectedVersion: snapshot.version,
  });
}

export function confirmationKey(snapshot: GuestSaved) {
  return JSON.stringify([
    snapshot.guestDraftId,
    snapshot.version,
    snapshot.currency,
    snapshot.quote?.preview,
  ]);
}

export const signedInEstimateAction = "Confirm estimate and open my draft";

export function guestEstimateText(snapshot: GuestSaved) {
  const preview = snapshot.quote?.preview;
  const amount = preview?.customQuote
    ? "Custom quote"
    : typeof preview?.totalCents === "number"
      ? formatMoney(preview.totalCents, preview.currency) + " " + preview.currency
      : "Unavailable";
  return `Version ${snapshot.version} · Estimated total ${amount}. Account offers and final pricing are checked after sign-in.`;
}

export function guestReadAction(
  result: GuestRead,
  signedIn: boolean,
  confirmed: string | null,
  bound: string | null,
) {
  if (bound && bound !== "creating" && result.guestDraftId !== bound) return "different";
  if ("claimed" in result) return "open";
  if (!signedIn) return "edit";
  return result.quote && confirmed === confirmationKey(result) ? "claim" : "confirm";
}

export function guestErrorAction(error: unknown) {
  if (error instanceof GuestRequestError) {
    if (error.status === 410) return "expired";
    if (error.status === 401)
      return error.claimed || error.code === "unauthenticated" ? "login" : "absent";
    if (error.status === 409) return "reload";
    if (error.status === 404) return "missing";
  }
  return "retry";
}

// Share the pending result across double clicks and Strict Mode effect replays.
export function singleFlight<T>() {
  let pending: Promise<T> | null = null;
  return (operation: () => Promise<T>) => {
    pending ??= Promise.resolve()
      .then(operation)
      .finally(() => {
        pending = null;
      });
    return pending;
  };
}
