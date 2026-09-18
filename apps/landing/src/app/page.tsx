"use client";

import { useEffect } from "react";
import { defaultLocale, locales, type Locale } from "@repo/i18n";

/**
 * Root page — redirects to the user's preferred locale.
 * Reads navigator.languages and matches against supported locales,
 * falling back to the default locale ("en").
 */
export default function RootPage() {
  useEffect(() => {
    const supported = new Set<string>(locales);
    let matched: Locale | undefined;

    for (const lang of window.navigator.languages ?? [window.navigator.language]) {
      // Try exact match first (e.g. "pt-BR" → not found, then "pt")
      if (supported.has(lang)) {
        matched = lang as Locale;
        break;
      }
      // Try base language (e.g. "en-US" → "en")
      const base = lang.split("-")[0];
      if (base && supported.has(base)) {
        matched = base as Locale;
        break;
      }
    }

    const locale = matched ?? defaultLocale;
    window.location.replace(`/${locale}/`);
  }, []);

  return null;
}
