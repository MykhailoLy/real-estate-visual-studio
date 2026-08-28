import "server-only";

import { cache } from "react";
import { getClientUser } from "@/lib/client-auth";
import { getClientProfile } from "@/lib/client-profile";

/** React-render scoped only: never persists identity between requests. */
export const getDashboardRequestUser = cache(getClientUser);

/** React-render scoped only: shares the dashboard profile read per request. */
export const getDashboardRequestProfile = cache(getClientProfile);
