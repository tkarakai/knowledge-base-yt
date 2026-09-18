"use client";

import { Link } from "@repo/i18n/navigation";
import { ArrowLeft, Info } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@repo/design-system";
import { SiteHeader } from "@repo/design-patterns";
import { LocaleSwitcher } from "./locale-switcher";

interface ContentPageLayoutProps {
  title: string;
  notice?: string;
  children: React.ReactNode;
}

export function ContentPageLayout({
  title,
  notice,
  children,
}: ContentPageLayoutProps) {
  const t = useTranslations("common");

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader
        appName={t("appName")}
        linkAs={Link}
        actions={<LocaleSwitcher />}
        className="top-[calc(var(--env-banner-h,0px)+var(--announcement-banner-h,0px))]"
      />
      <main className="flex-1 pt-[calc(5rem+var(--announcement-banner-h,0px))]">
        <div className="mx-auto flex max-w-3xl flex-col px-6 py-8">
          <Link
            href="/"
            className="mb-8 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToHome")}
          </Link>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {notice ? (
            <Alert className="mb-8 mt-8">
              <Info className="h-4 w-4" />
              <AlertTitle>{t("note")}</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground pb-24">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
