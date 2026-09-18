"use client";

import { useTranslations } from "next-intl";
import { Link } from "@repo/i18n/navigation";

import { SiteHeader as SharedSiteHeader } from "@repo/design-patterns";
import { LocaleSwitcher } from "./locale-switcher";

export function SiteHeader() {
  const t = useTranslations("common");

  return (
    <SharedSiteHeader
      appName={t("appName")}
      linkAs={Link}
      actions={<LocaleSwitcher />}
    />
  );
}
