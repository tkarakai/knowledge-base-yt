import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContentPageLayout } from "@/components/content-page-layout";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.about" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("legal.about");

  return (
    <ContentPageLayout title={t("heading")} notice={t("notice")}>
      <p>{t("intro")}</p>

      <h2 className="text-lg font-semibold text-foreground">{t("mission")}</h2>
      <p>{t("missionText")}</p>

      <h2 className="text-lg font-semibold text-foreground">
        {t("whatIncluded")}
      </h2>
      <p>{t("whatIncludedText")}</p>

      <h2 className="text-lg font-semibold text-foreground">
        {t("openSource")}
      </h2>
      <p>{t("openSourceText")}</p>
    </ContentPageLayout>
  );
}
