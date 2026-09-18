import type { MetadataRoute } from "next";
import { locales } from "@repo/i18n";

export const dynamic = "force-static";

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
    { path: "/", priority: 1.0, changeFrequency: "weekly" as const },
    { path: "/about", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/privacy", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/terms", priority: 0.5, changeFrequency: "monthly" as const },
  ];

  return routes.flatMap(({ path, priority, changeFrequency }) =>
    locales.map((locale) => ({
      url: `${SITE_URL}/${locale}${path === "/" ? "" : path}`,
      lastModified: new Date(),
      changeFrequency,
      priority,
      alternates: generateAlternates(path),
    }))
  );
}
