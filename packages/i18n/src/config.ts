/** Supported locales — add new locales here and provide a matching messages/*.json file. */
export const locales = [
  "en", "cs", "de", "es", "fr", "it", "hu", "nl", "pl",
  "pt", "ru", "zh", "ja", "ar", "he",
] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Metadata for each locale used in the language selector UI. */
export const localeMetadata: Record<
  Locale,
  { name: string; nativeName: string; dir: "ltr" | "rtl"; flag: string }
> = {
  en: { name: "English", nativeName: "English", dir: "ltr", flag: "🇺🇸" },
  cs: { name: "Czech", nativeName: "Čeština", dir: "ltr", flag: "🇨🇿" },
  de: { name: "German", nativeName: "Deutsch", dir: "ltr", flag: "🇩🇪" },
  es: { name: "Spanish", nativeName: "Español", dir: "ltr", flag: "🇪🇸" },
  fr: { name: "French", nativeName: "Français", dir: "ltr", flag: "🇫🇷" },
  it: { name: "Italian", nativeName: "Italiano", dir: "ltr", flag: "🇮🇹" },
  hu: { name: "Hungarian", nativeName: "Magyar", dir: "ltr", flag: "🇭🇺" },
  nl: { name: "Dutch", nativeName: "Nederlands", dir: "ltr", flag: "🇳🇱" },
  pl: { name: "Polish", nativeName: "Polski", dir: "ltr", flag: "🇵🇱" },
  pt: { name: "Portuguese", nativeName: "Português", dir: "ltr", flag: "🇧🇷" },
  ru: { name: "Russian", nativeName: "Русский", dir: "ltr", flag: "🇷🇺" },
  zh: { name: "Chinese", nativeName: "中文", dir: "ltr", flag: "🇨🇳" },
  ja: { name: "Japanese", nativeName: "日本語", dir: "ltr", flag: "🇯🇵" },
  ar: { name: "Arabic", nativeName: "العربية", dir: "rtl", flag: "🇸🇦" },
  he: { name: "Hebrew", nativeName: "עברית", dir: "rtl", flag: "🇮🇱" },
};

const rtlLocales = new Set<string>(["ar", "he", "fa", "ur"]);

/** Returns `"rtl"` for right-to-left locales, `"ltr"` otherwise. */
export function getLocaleDirection(locale: string): "ltr" | "rtl" {
  return rtlLocales.has(locale) ? "rtl" : "ltr";
}
