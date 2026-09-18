import { getRequestConfig } from "next-intl/server";

import { type Locale, locales } from "./config";

/**
 * next-intl request configuration.
 * Loads the message bundle for the requested locale at runtime.
 *
 * Usage: import this module from `i18n/request.ts` in each Next.js app
 * (required by next-intl's plugin / middleware).
 */
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Validate — fall back to en if the requested locale is unknown
  if (!locale || !locales.includes(locale as Locale)) {
    locale = "en";
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
