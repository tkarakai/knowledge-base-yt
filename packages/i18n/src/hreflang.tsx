import { locales, defaultLocale } from "./config";

type HreflangLinksProps = {
  locale: string;
  pathname: string;
  siteUrl: string;
};

/**
 * Generates hreflang link tags for all locale variants.
 * Must be rendered in <head> via root layout to inform search engines
 * about alternate language versions of the page.
 *
 * @param locale - Current locale (e.g., "en", "fr")
 * @param pathname - Current pathname without locale prefix (e.g., "/dashboard", "/")
 * @param siteUrl - Base site URL (e.g., "http://localhost:3001")
 * @returns JSX fragment containing hreflang link tags
 */
export function HreflangLinks({
  locale: _locale,
  pathname,
  siteUrl,
}: HreflangLinksProps) {
  const links = locales.map((loc) => ({
    hreflang: loc,
    href: `${siteUrl}/${loc}${pathname === "/" ? "" : pathname}`,
  }));

  const defaultUrl = `${siteUrl}/${defaultLocale}${pathname === "/" ? "" : pathname}`;

  return (
    <>
      {links.map(({ hreflang, href }) => (
        <link key={hreflang} rel="alternate" hrefLang={hreflang} href={href} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={defaultUrl} />
    </>
  );
}
