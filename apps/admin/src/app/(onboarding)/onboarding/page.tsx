import { SiteHeader } from "@repo/design-patterns";
import { AdminOnboardingWizard } from "@/components/onboarding/admin-onboarding-wizard";
import { OnboardingProfileMenu } from "@/components/onboarding/onboarding-profile-menu";

export default function OnboardingPage() {
  return (
    <main
      className="flex min-h-[calc(100dvh-var(--env-banner-h,0px))] flex-col"
      style={{ background: "var(--glow-warm-intense)" }}
    >
      <SiteHeader appName="Web App Starter Administration" actions={<OnboardingProfileMenu />} />
      <div className="flex flex-1 items-center justify-center overflow-y-auto p-4 pt-20">
        <AdminOnboardingWizard />
      </div>
    </main>
  );
}
