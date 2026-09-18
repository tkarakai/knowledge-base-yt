import type { MetadataRoute } from "next";
import { locales } from "@repo/i18n";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
if (!SITE_URL) {
  throw new Error("Missing required environment variable: NEXT_PUBLIC_SITE_URL");
}

function generateAlternates(pathname: string) {
  return {
    languages: Object.fromEntries(
      locales.map((locale) => [
        locale,
        `${SITE_URL}/${locale}${pathname === "/" ? "" : pathname}`,
      ])
    ),
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "/sign-in", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/sign-up", priority: 0.7, changeFrequency: "monthly" as const },
    {
      path: "/dashboard",
      priority: 0.3,
      changeFrequency: "always" as const,
    },
  ];

  return routes.flatMap(({ path, priority, changeFrequency }) =>
    locales.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency,
      priority,
      alternates: generateAlternates(path),
    }))
  );
}
