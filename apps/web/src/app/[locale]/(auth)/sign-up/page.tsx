import { getTranslations } from "next-intl/server";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system";
import { SiteHeader } from "@repo/design-patterns";
import { AuthForm } from "@/components/auth/auth-form";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL;
if (!LANDING_URL) {
  throw new Error("Missing required environment variable: NEXT_PUBLIC_LANDING_URL");
}
const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
if (!CONVEX_SITE_URL) {
  throw new Error("Missing required environment variable: NEXT_PUBLIC_CONVEX_SITE_URL");
}

type OnboardingType = "inviteOnly" | "publicWaitlist" | "publicSignup";

async function getOnboardingType(): Promise<OnboardingType> {
  try {
    const res = await fetch(`${CONVEX_SITE_URL}/api/waitlist/status`, {
      next: { revalidate: 60 },
    });
    const data = (await res.json()) as {
      onboardingType?:
        | OnboardingType
        | "none"
        | "waitlist"
        | "signup";
      waitlistEnabled?: boolean;
      signupEnabled?: boolean;
      enabled?: boolean;
    };

    if (
      data.onboardingType === "inviteOnly" ||
      data.onboardingType === "publicWaitlist" ||
      data.onboardingType === "publicSignup"
    ) {
      return data.onboardingType;
    }
    if (data.onboardingType === "waitlist") return "publicWaitlist";
    if (data.onboardingType === "signup") return "publicSignup";
    if (data.onboardingType === "none") return "inviteOnly";
    if (data.waitlistEnabled === true || data.enabled === true) return "publicWaitlist";
    if (data.signupEnabled === true) return "publicSignup";
    return "publicSignup";
  } catch {
    return "publicSignup";
  }
}

export default async function SignUpPage() {
  const t = await getTranslations("auth.signUp");
  const ts = await getTranslations("auth.signIn");
  const tc = await getTranslations("common");
  const ti = await getTranslations("auth.invitation");
  const onboardingType = await getOnboardingType();

  return (
    <main
      className="flex min-h-[calc(100dvh-var(--env-banner-h,0px))] flex-col"
      style={{ background: "var(--glow-cool)" }}
    >
      <SiteHeader appName={tc("appName")} homeHref={LANDING_URL} actions={<LocaleSwitcher />} />
      <div className="mx-auto grid flex-1 max-w-6xl items-start justify-items-center gap-12 px-6 pb-16 pt-[calc(6rem+var(--announcement-banner-h,0px))] lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:justify-items-stretch">
        <section className="w-full max-w-md space-y-6 lg:max-w-none">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {tc("appName")}
          </p>
          <h1 className="text-4xl font-semibold leading-tight">
            {t("pageHeading")}
          </h1>
          <p className="max-w-lg text-sm text-muted-foreground">
            {t("pageDescription")}
          </p>
        </section>
        {onboardingType === "publicSignup" ? (
          <AuthForm mode="sign-up" />
        ) : (
          <Card className="w-full max-w-md border-border/60 bg-card/80 shadow-xl shadow-primary/5">
            <CardHeader>
              <CardTitle>{ti("signupBlocked")}</CardTitle>
              <CardDescription>
                {onboardingType === "publicWaitlist"
                  ? ti("signupBlockedDescription")
                  : ts("description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                {onboardingType === "publicWaitlist" ? (
                  <a href={LANDING_URL}>{ti("goToWaitlist")}</a>
                ) : (
                  <a href="/sign-in">{ts("cta")}</a>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
