"use client";

import { useLayoutEffect } from "react";

/**
 * Sets lang and dir attributes on the <html> element.
 * Uses useLayoutEffect so it runs synchronously before the browser paints,
 * avoiding any flash of incorrect direction. Returns null so it doesn't
 * affect the React component tree or hydration.
 */
export function DocumentLocale({ lang, dir }: { lang: string; dir: string }) {
  useLayoutEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);
  return null;
}
