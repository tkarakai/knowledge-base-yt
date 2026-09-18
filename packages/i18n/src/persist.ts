const LOCALE_KEY = "NEXT_LOCALE";
const COOKIE_MAX_AGE = 31536000; // 1 year in seconds

/**
 * Persist the user's locale choice to a cookie (for server-side middleware)
 * and localStorage (as a fallback).
 *
 * The next-intl middleware reads the `NEXT_LOCALE` cookie by default
 * to determine preferred locale during redirects.
 */
export function persistLocale(locale: string): void {
  document.cookie = `${LOCALE_KEY}=${locale};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;

  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // May be unavailable (incognito, storage quota, etc.)
  }
}
