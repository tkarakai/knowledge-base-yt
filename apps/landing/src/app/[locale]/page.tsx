import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";

import { Badge } from "@repo/design-system";
import { SiteHeader } from "@/components/site-header";
import { HeroCta } from "@/components/hero-cta";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("landing");

  return (
    <main
      className="relative flex min-h-screen items-center justify-center"
      style={{ background: "var(--glow-warm)" }}
    >
      <SiteHeader />
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 px-6 text-center">
        <Badge variant="secondary" className="text-xs uppercase tracking-widest">
          {t("badge")}
        </Badge>

        <h1 className="text-5xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
          {t("heading")}
          <br />
          {t("headingLine2")}
        </h1>

        <p className="max-w-lg text-base text-muted-foreground">
          {t("description")}
        </p>

        <HeroCta />
      </div>
    </main>
  );
}
