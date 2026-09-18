import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContentPageLayout } from "@/components/content-page-layout";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("legal.privacy");

  return (
    <ContentPageLayout title={t("heading")} notice={t("notice")}>
      <p>{t("notice")}</p>
      <p>
        This is a template privacy policy. You should replace this with your own
        privacy policy that describes how your application collects, uses, and
        protects user data.
      </p>
    </ContentPageLayout>
  );
}
