"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { signOutBrowserSession } from "@/lib/sign-out";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type PublicAuthStatus = "loading" | "guest" | "authenticated";

interface PublicAuthUser {
  firstName: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

interface PublicAuthContextValue {
  status: PublicAuthStatus;
  user: PublicAuthUser | null;
  signOut: () => Promise<boolean>;
}

interface ClientProfileName {
  first_name: string | null;
  full_name: string | null;
}

const PublicAuthContext = createContext<PublicAuthContextValue | null>(null);

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned || null;
}

function firstWord(value: string | null): string | null {
  return value?.split(" ")[0] || null;
}

function emailDerivedName(email: string): string | null {
  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return null;

  const words = localPart
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return words.join(" ") || null;
}

function validAvatarUrl(value: unknown): string | null {
  const candidate = cleanText(value);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

async function buildPublicAuthUser(user: User): Promise<PublicAuthUser> {
  const supabase = createBrowserSupabaseClient();
  const { data } = await supabase
    .from("client_profiles")
    .select("first_name, full_name")
    .maybeSingle<ClientProfileName>();

  const profileFirstName = cleanText(data?.first_name);
  const profileFullName = cleanText(data?.full_name);
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const metadataName =
    cleanText(metadata.display_name) ??
    cleanText(metadata.full_name) ??
    cleanText(metadata.name);
  const email = cleanText(user.email) ?? "";
  const emailName = emailDerivedName(email);

  const firstName =
    profileFirstName ??
    firstWord(profileFullName) ??
    firstWord(metadataName) ??
    firstWord(emailName) ??
    "Client";
  const displayName =
    profileFullName ??
    profileFirstName ??
    metadataName ??
    emailName ??
    "Client";
  const avatarUrl =
    validAvatarUrl(metadata.avatar_url) ?? validAvatarUrl(metadata.picture);

  return { firstName, displayName, email, avatarUrl };
}

export function PublicAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<PublicAuthStatus>("loading");
  const [user, setUser] = useState<PublicAuthUser | null>(null);
  const syncVersionRef = useRef(0);

  const syncUser = useCallback(async (authUser: User | null) => {
    const syncVersion = ++syncVersionRef.current;

    if (!authUser) {
      setUser(null);
      setStatus("guest");
      return;
    }

    try {
      const nextUser = await buildPublicAuthUser(authUser);
      if (syncVersion !== syncVersionRef.current) return;
      setUser(nextUser);
      setStatus("authenticated");
    } catch {
      if (syncVersion !== syncVersionRef.current) return;

      const email = cleanText(authUser.email) ?? "";
      const emailName = emailDerivedName(email);
      const metadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;
      const metadataName =
        cleanText(metadata.display_name) ??
        cleanText(metadata.full_name) ??
        cleanText(metadata.name);
      const displayName = metadataName ?? emailName ?? "Client";

      setUser({
        firstName: firstWord(metadataName) ?? firstWord(emailName) ?? "Client",
        displayName,
        email,
        avatarUrl:
          validAvatarUrl(metadata.avatar_url) ?? validAvatarUrl(metadata.picture),
      });
      setStatus("authenticated");
    }
  }, []);

  useEffect(() => {
    let active = true;

    try {
      const supabase = createBrowserSupabaseClient();

      void supabase.auth
        .getUser()
        .then(({ data }) => {
          if (active) void syncUser(data.user ?? null);
        })
        .catch(() => {
          if (active) void syncUser(null);
        });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          if (active) void syncUser(null);
          return;
        }

        window.setTimeout(() => {
          void supabase.auth
            .getUser()
            .then(({ data }) => {
              if (active) void syncUser(data.user ?? null);
            })
            .catch(() => {
              if (active) void syncUser(null);
            });
        }, 0);
      });

      return () => {
        active = false;
        syncVersionRef.current += 1;
        subscription.unsubscribe();
      };
    } catch {
      window.queueMicrotask(() => {
        if (active) void syncUser(null);
      });
      return () => {
        active = false;
      };
    }
  }, [syncUser]);

  const signOut = useCallback(async () => {
    const succeeded = await signOutBrowserSession();
    if (succeeded) {
      syncVersionRef.current += 1;
      setUser(null);
      setStatus("guest");
    }
    return succeeded;
  }, []);

  return (
    <PublicAuthContext.Provider value={{ status, user, signOut }}>
      {children}
    </PublicAuthContext.Provider>
  );
}

export function usePublicAuth(): PublicAuthContextValue {
  const value = useContext(PublicAuthContext);
  if (!value) {
    throw new Error("usePublicAuth must be used within PublicAuthProvider");
  }
  return value;
}
