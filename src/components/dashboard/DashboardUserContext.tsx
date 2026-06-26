"use client";

// DashboardUserContext
//
// Provides the authenticated user to any client component in the
// dashboard subtree without requiring every page to pass it as a prop.
//
// The server layout reads the user from the cookie and sets this
// context via DashboardUserProvider. Client components (TopNav,
// MobileNav) read it with useDashboardUser().

import { createContext, useContext, type ReactNode } from "react";

// ── Type ──────────────────────────────────────────────────────

export interface DashboardUser {
  email: string;
  displayName: string;
  firstName: string;
  /** First name from client_profiles row; null if onboarding not yet complete */
  profileName: string | null;
  avatarUrl: string | null;
}

const DashboardUserContext = createContext<DashboardUser | null>(null);

export function DashboardUserProvider({
  user,
  children,
}: {
  user: DashboardUser | null;
  children: ReactNode;
}) {
  return (
    <DashboardUserContext.Provider value={user}>
      {children}
    </DashboardUserContext.Provider>
  );
}

/** Returns the current dashboard user, or null if not authenticated. */
export function useDashboardUser(): DashboardUser | null {
  return useContext(DashboardUserContext);
}
