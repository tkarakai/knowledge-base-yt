"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { defaultLocale, persistLocale } from "@repo/i18n";
import { getAuthUserLocaleAction } from "@/app/actions";

/**
 * Get the current locale from the URL (the browser's current preference at auth page).
 */
function getCurrentLocaleFromUrl(): string {
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    const match = path.match(/^\/([a-z]{2}(?:-[A-Z]{2})?)/);
    if (match) {
      return match[1];
    }
  }
  return defaultLocale;
}

/**
 * Redirect to dashboard with the user's preferred locale.
 * Calls a server action to fetch the user's profile locale, falls back to browser locale or default.
 *
 * Priority:
 * 1. User's profile locale (if explicitly set in dashboard preferences)
 * 2. Browser's current locale (from URL or localStorage)
 * 3. Default locale (en)
 */
export async function redirectWithUserLocale(router: AppRouterInstance): Promise<void> {
  try {
    // Fetch user's profile locale via server action
    // This returns null if user hasn't set a preference yet
    const userLocale = await getAuthUserLocaleAction();
    const currentLocale = getCurrentLocaleFromUrl();

    // Use profile locale if it's explicitly set, otherwise keep current browser locale
    const targetLocale = userLocale ?? currentLocale;

    // Persist the target locale in browser storage for next-intl middleware
    persistLocale(targetLocale);

    // Redirect to dashboard with the target locale
    router.push(`/${targetLocale}/dashboard`);
  } catch {
    // If anything fails, fall back to current browser locale
    const currentLocale = getCurrentLocaleFromUrl();
    persistLocale(currentLocale);
    router.push(`/${currentLocale}/dashboard`);
  }
}
