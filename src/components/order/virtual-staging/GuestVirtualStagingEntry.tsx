"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import VirtualStagingOrderForm from "./VirtualStagingOrderForm";
import {
  claimGuestDraft,
  confirmationKey,
  getGuestDraft,
  guestErrorAction,
  guestReadAction,
  guestEstimateText,
  signedInEstimateAction,
  singleFlight,
  type guestSaveBody,
  type GuestSaved,
} from "@/lib/guest-order-drafts/client";
import { GUEST_ENTRY, GUEST_LOGIN } from "@/lib/guest-order-drafts/entry";
import { VIRTUAL_STAGING_DRAFT_ROUTE } from "@/lib/order-drafts/virtual-staging";
import { trackGuestDraftEvent } from "@/lib/analytics";
import type { ServiceOptionMedia } from "@/lib/site-media";
import { NO_WELCOME_OFFER_AVAILABLE } from "@/lib/welcome-offer";

const BINDING = "picchu:guest-staging:binding";
const CONFIRMED = "picchu:guest-staging:confirmed";

function read(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* A fresh confirmation is available after sign-in if storage is disabled. */
  }
}

type GuestInput = ReturnType<typeof guestSaveBody>;
type Editor = { initial: GuestSaved | null; input?: GuestInput; fresh: boolean; key: number };
export interface GuestEditor extends Editor {
  signedIn: boolean;
  onCreating: () => void;
  onSaved: (snapshot: GuestSaved) => void;
  onRecover: (previous: GuestSaved | null, input: GuestInput) => void;
  onConfirm: (snapshot: GuestSaved) => Promise<void>;
}

type Panel =
  | { kind: "busy" | "expired" | "missing" | "login" | "retry" }
  | { kind: "review"; snapshot: GuestSaved; conflict?: boolean; retryInput?: GuestInput }
  | { kind: "different" };

const messages = {
  busy: "Checking your saved draft…",
  expired: "Your guest draft expired. You can start a new draft.",
  missing: "This browser no longer has access to that draft. Check again or start a new one.",
  different:
    "This tab and the browser cookie refer to different drafts. Reopen the saved version to continue.",
  login: "Sign in to open the draft linked to your account.",
  retry: "We couldn’t verify the draft. Check again to continue from the last saved version.",
  review: "Review the latest saved version and estimate before continuing.",
};
const button =
  "min-h-11 rounded-lg border border-primary px-4 py-2 font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2";

export default function GuestVirtualStagingEntry({
  signedIn,
  exampleMediaByKey,
  children,
}: {
  children?: ReactNode;
  signedIn: boolean;
  exampleMediaByKey: Record<string, ServiceOptionMedia>;
}) {
  const router = useRouter();
  const [useAccountForm, setUseAccountForm] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [panel, setPanel] = useState<Panel | null>({ kind: "busy" });
  const generation = useRef({ sequence: 0 });
  const editorKey = useRef(0);
  const startedFromPanel = useRef<Panel | null>(null);
  const [claimOnce] = useState(singleFlight<Awaited<ReturnType<typeof claimGuestDraft>>>);
  const reviewRequired = useRef(false);
  const unsaved = useRef<{ previous: GuestSaved | null; input: GuestInput } | null>(null);
  const openDraft = useCallback(
    (id: string) => {
      trackGuestDraftEvent("guest_draft_resume");
      store(BINDING, null);
      store(CONFIRMED, null);
      router.replace(VIRTUAL_STAGING_DRAFT_ROUTE + "?draft=" + encodeURIComponent(id));
    },
    [router],
  );
  const edit = useCallback((snapshot: GuestSaved | null, fresh = false, input?: GuestInput) => {
    store(BINDING, snapshot?.guestDraftId ?? null);
    store(CONFIRMED, null);
    reviewRequired.current = false;
    unsaved.current = null;
    setEditor({ initial: snapshot, input, fresh, key: ++editorKey.current });
    setPanel(null);
  }, []);

  const claim = useCallback(
    async (snapshot: GuestSaved, session: number) => {
      try {
        const claimed = await claimOnce(() => {
          trackGuestDraftEvent("guest_claim_start");
          return claimGuestDraft(snapshot);
        });
        if (generation.current.sequence !== session) return;
        trackGuestDraftEvent("guest_claim_success");
        openDraft(claimed.draftId);
      } catch (error) {
        if (generation.current.sequence !== session) return;
        trackGuestDraftEvent("guest_claim_error");
        if (guestErrorAction(error) !== "reload") throw error;
        reviewRequired.current = true;
        const latest = await getGuestDraft();
        if (generation.current.sequence !== session) return;
        if (latest.guestDraftId !== snapshot.guestDraftId) setPanel({ kind: "different" });
        else if ("claimed" in latest) openDraft(latest.draftId);
        else setPanel({ kind: "review", snapshot: latest, conflict: true });
      }
    },
    [claimOnce, openDraft],
  );

  const continueInAccount = useCallback(() => {
    if (children) setUseAccountForm(true);
    else router.replace(VIRTUAL_STAGING_DRAFT_ROUTE + "?new=1");
  }, [children, router]);

  const load = useCallback(
    async (review = false, acceptBinding = false) => {
      const session = ++generation.current.sequence;
      if (review) reviewRequired.current = true;
      setPanel({ kind: "busy" });
      try {
        const result = await getGuestDraft();
        if (generation.current.sequence !== session) return;
        const action = guestReadAction(
          result,
          signedIn,
          read(CONFIRMED),
          acceptBinding ? null : read(BINDING),
        );
        if (action === "different") {
          setPanel({ kind: "different" });
          return;
        }
        if ("claimed" in result) {
          if (children && !read(BINDING) && !read(CONFIRMED)) setUseAccountForm(true);
          else openDraft(result.draftId);
          return;
        }
        store(BINDING, result.guestDraftId);
        if (reviewRequired.current || action === "confirm") {
          const pending = unsaved.current;
          const retryInput =
            pending?.previous && confirmationKey(pending.previous) === confirmationKey(result)
              ? pending.input
              : undefined;
          setPanel({
            kind: "review",
            snapshot: result,
            retryInput,
            conflict: Boolean(pending?.previous && pending.previous.version !== result.version),
          });
          return;
        }
        if (action === "edit") {
          edit(result);
          return;
        }
        await claim(result, session);
      } catch (error) {
        if (generation.current.sequence !== session) return;
        const action = guestErrorAction(error);
        if (action === "absent" && !read(BINDING) && !reviewRequired.current) {
          if (signedIn) continueInAccount();
          else edit(null);
        } else {
          setPanel({ kind: action === "absent" ? "missing" : action === "reload" ? "retry" : action });
        }
      }
    },
    [children, claim, continueInAccount, edit, openDraft, signedIn],
  );

  useEffect(() => {
    const lifecycle = generation.current;
    const started = lifecycle.sequence;
    window.queueMicrotask(() => {
      if (lifecycle.sequence === started) void load();
    });
    return () => {
      lifecycle.sequence++;
    };
  }, [load]);

  async function confirm(snapshot: GuestSaved) {
    const session = ++generation.current.sequence;
    setPanel({ kind: "busy" });
    try {
      const latest = await getGuestDraft();
      if (generation.current.sequence !== session) return;
      if (latest.guestDraftId !== snapshot.guestDraftId) {
        setPanel({ kind: "different" });
        return;
      }
      if ("claimed" in latest) {
        openDraft(latest.draftId);
        return;
      }
      if (!latest.quote || confirmationKey(latest) !== confirmationKey(snapshot)) {
        reviewRequired.current = true;
        setPanel({ kind: "review", snapshot: latest, conflict: latest.version !== snapshot.version });
        return;
      }
      store(CONFIRMED, confirmationKey(latest));
      if (!signedIn) {
        router.push(GUEST_LOGIN);
        return;
      }
      await claim(latest, session);
    } catch (error) {
      if (generation.current.sequence !== session) return;
      const action = guestErrorAction(error);
      setPanel({ kind: action === "absent" ? "missing" : action === "reload" ? "retry" : action });
    }
  }

  function startNew() {
    if (!panel || startedFromPanel.current === panel) return;
    startedFromPanel.current = panel;
    if (signedIn) {
      store(BINDING, null);
      store(CONFIRMED, null);
      router.replace(VIRTUAL_STAGING_DRAFT_ROUTE + "?new=1");
    } else edit(null, true, unsaved.current?.input);
  }

  if (useAccountForm) return children;
  return (
    <>
      {panel && (
        <section className="mx-auto my-12 w-full max-w-2xl space-y-4 rounded-xl border border-border bg-white p-5 sm:p-8">
          <h1 className="text-2xl font-bold text-primary">Virtual Staging draft</h1>
          <p role="status">
            {panel.kind === "review" && panel.conflict
              ? "The saved version changed. Review the latest estimate before using this version."
              : messages[panel.kind]}
          </p>
          {panel.kind === "review" && <p>{guestEstimateText(panel.snapshot)}</p>}
          <div className="flex flex-wrap gap-3">
            {panel.kind === "review" && (
              <button
                className={button}
                onClick={() => (signedIn ? void confirm(panel.snapshot) : edit(panel.snapshot))}
              >
                {signedIn ? signedInEstimateAction : "Use saved version"}
              </button>
            )}
            {panel.kind === "review" && !signedIn && panel.retryInput && (
              <button className={button} onClick={() => edit(panel.snapshot, false, panel.retryInput)}>
                Retry my unsaved changes
              </button>
            )}
            {panel.kind === "different" && (
              <button className={button} onClick={() => void load(true, true)}>
                Review browser draft
              </button>
            )}
            {(panel.kind === "retry" || panel.kind === "missing") && (
              <button className={button} onClick={() => void load()}>
                Check again
              </button>
            )}
            {panel.kind === "retry" && children && (
              <button className={button} onClick={continueInAccount}>
                Continue in account
              </button>
            )}
            {(panel.kind === "retry" ||
              panel.kind === "missing" ||
              panel.kind === "expired" ||
              panel.kind === "login" ||
              panel.kind === "different") && (
              <button className={button} onClick={startNew}>
                Start a new draft
              </button>
            )}
            {panel.kind === "login" && (
              <a className={button} href={GUEST_LOGIN}>
                Sign in
              </a>
            )}
          </div>
        </section>
      )}
      {editor && (
        <div hidden={Boolean(panel)}>
          <VirtualStagingOrderForm
            key={editor.key}
            clientEmail=""
            orderRoute={GUEST_ENTRY}
            welcomeOfferAvailability={NO_WELCOME_OFFER_AVAILABLE}
            exampleMediaByKey={exampleMediaByKey}
            guest={{
              ...editor,
              signedIn,
              onCreating: () => store(BINDING, "creating"),
              onSaved: (snapshot) => store(BINDING, snapshot.guestDraftId),
              onRecover: (previous, input) => {
                unsaved.current = { previous, input };
                void load(true);
              },
              onConfirm: confirm,
            }}
          />
        </div>
      )}
    </>
  );
}
