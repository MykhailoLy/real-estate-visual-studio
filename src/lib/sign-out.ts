"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export async function signOutBrowserSession(): Promise<boolean> {
  try {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    return !error;
  } catch {
    return false;
  }
}
