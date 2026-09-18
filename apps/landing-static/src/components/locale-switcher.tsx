"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

import { LanguageSelector } from "@repo/design-patterns";
import { locales, localeMetadata, persistLocale, type Locale } from "@repo/i18n";

interface LocaleSwitcherProps {
  className?: string;
  variant?: "standalone" | "submenu";
}

export function LocaleSwitcher({ className, variant }: LocaleSwitcherProps) {
  const locale = useLocale();
  const tl = useTranslations("language");
  const pathname = usePathname();
  const router = useRouter();

  const localeOptions = locales.map((code) => ({
    code,
    nativeName: localeMetadata[code as Locale].nativeName,
    flag: localeMetadata[code as Locale].flag,
  }));

  const handleLocaleChange = (newLocale: string) => {
    persistLocale(newLocale);
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
    />
  );
}
