"use client";

import { Link } from "@repo/i18n/navigation";
import { useTranslations } from "next-intl";

import { Separator } from "@repo/design-system";

export function Footer() {
  const t = useTranslations("landing.footer");

  return (
    <footer className="w-full">
      <Separator />
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Web App Starter</p>
        <nav className="flex gap-6">
          <Link
            href="/about"
            className="transition-colors hover:text-foreground"
          >
            {t("about")}
          </Link>
          <Link
            href="/privacy"
            className="transition-colors hover:text-foreground"
          >
            {t("privacyPolicy")}
          </Link>
          <Link
            href="/terms"
            className="transition-colors hover:text-foreground"
          >
            {t("termsOfService")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
