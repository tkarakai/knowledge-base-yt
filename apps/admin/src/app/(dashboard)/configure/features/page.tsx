import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/design-system";
import { InviteOnlyFeatureCard } from "@/components/features/invite-only-feature-card";
import { SignupFeatureCard } from "@/components/features/signup-feature-card";
import { WaitlistFeatureCard } from "@/components/features/waitlist-feature-card";

export default function FeaturesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Features</h1>
        <p className="text-sm text-muted-foreground">
          Manage feature controls for the application.
        </p>
      </div>
      <div id="onboarding-feature" className="max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Onboarding</CardTitle>
            <CardDescription>
              Choose exactly one onboarding mode for new users.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <InviteOnlyFeatureCard />
            <WaitlistFeatureCard />
            <SignupFeatureCard />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
