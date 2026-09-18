import { createNavigation } from "next-intl/navigation";

import { defaultLocale, locales } from "./config";

/**
 * Typed navigation primitives that include the locale prefix automatically.
 * Use these instead of next/link and next/navigation in app code.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation({ locales, defaultLocale, localePrefix: "always" });
