"use server";

import { api } from "@repo/backend";
import { fetchQuery } from "convex/nextjs";

/**
 * Server action to fetch the authenticated user's preferred locale from their profile.
 * Returns the locale if set, otherwise null (falls back to default/browser locale).
 *
 * Note: This is called immediately after authentication succeeds, so the session
 * cookie should be present and valid.
 */
export async function getAuthUserLocaleAction(): Promise<string | null> {
  try {
    // Fetch the user's profile locale from Convex.
    // The session is automatically included in the server context via cookies.
    const locale = await fetchQuery(api.userProfiles.getLocale, {});
    return locale;
  } catch {
    // On any error (not authenticated, network issue, etc.), return null
    // The caller will fall back to the browser's current locale
    return null;
  }
}
