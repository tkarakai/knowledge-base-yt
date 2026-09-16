"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useMutation } from "convex/react";

import { LanguageSelector } from "@repo/design-patterns";
import { useNetworkStatus } from "@repo/design-system";
import { locales, localeMetadata, persistLocale, type Locale } from "@repo/i18n";
import { api } from "@repo/backend";
import { useAuthUser } from "@/components/auth/auth-guard";

interface LocaleSwitcherProps {
  className?: string;
  variant?: "standalone" | "submenu";
}

export function LocaleSwitcher({ className, variant }: LocaleSwitcherProps) {
  const locale = useLocale();
  const tl = useTranslations("language");
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthUser();
  const setLocale = useMutation(api.userProfiles.setLocale);
  const isOnline = useNetworkStatus();

  const localeOptions = locales.map((code) => ({
    code,
    nativeName: localeMetadata[code as Locale].nativeName,
    flag: localeMetadata[code as Locale].flag,
  }));

  const handleLocaleChange = (newLocale: string) => {
    // Save to localStorage + cookie (immediate, for next-intl middleware)
    persistLocale(newLocale);

    // Save to Convex if authenticated (fire-and-forget, non-blocking)
    if (user) {
      setLocale({ locale: newLocale }).catch(() => {
        // Non-blocking; localStorage will be used as fallback
      });
    }

    // Navigate to new locale path, preserving query parameters (e.g. invitation token)
    const segments = pathname.split("/");
    segments[1] = newLocale;
    const newPath = segments.join("/") || `/${newLocale}`;
    const search = window.location.search;
    router.push(`${newPath}${search}`);
  };

  return (
    <LanguageSelector
      currentLocale={locale}
      locales={localeOptions}
      onSelect={handleLocaleChange}
      ariaLabel={tl("ariaLabel")}
      className={className}
      variant={variant}
      disabled={!isOnline}
    />
  );
}
