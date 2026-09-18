"use client";

import { EnvironmentBanner } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

const sampleEnvVars: Record<string, string> = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3001",
  NEXT_PUBLIC_CONVEX_URL: "https://happy-animal-123.convex.cloud",
  NEXT_PUBLIC_CONVEX_SITE_URL: "https://happy-animal-123.convex.site",
  NEXT_PUBLIC_LANDING_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_ENVIRONMENT: "development",
  NEXT_PUBLIC_GIT_BRANCH: "feat/environment-banner",
  NEXT_PUBLIC_GIT_SHA: "a1b2c3d4e5f6789012345678",
  NEXT_PUBLIC_APP_NAME: "web",
};

export default function EnvironmentBannerShowcase() {
  return (
    <>
      <DemoSection
        title="Development"
        description="Teal banner shown in local development. Hover to expand."
      >
        <EnvironmentBanner
          environment="development"
          position="static"
          appName="web"
          gitBranch="feat/environment-banner"
          gitSha="a1b2c3d4e5f6789012345678"
          deployedAt={new Date().toISOString()}
          envVars={sampleEnvVars}
        />
      </DemoSection>

      <DemoSection
        title="Staging"
        description="Amber banner shown in staging deployments. Hover to expand."
      >
        <EnvironmentBanner
          environment="staging"
          position="static"
          appName="web"
          gitBranch="main"
          gitSha="9876543fedcba0123456789a"
          deployedAt={new Date(
            Date.now() - 2 * 60 * 60 * 1000
          ).toISOString()}
          buildId="bld_abc123"
          envVars={{
            NEXT_PUBLIC_SITE_URL: "https://staging.example.com",
            NEXT_PUBLIC_APP_ENVIRONMENT: "staging",
            NEXT_PUBLIC_GIT_BRANCH: "main",
            NEXT_PUBLIC_APP_NAME: "web",
          }}
        />
      </DemoSection>

      <DemoSection
        title="Production (Hidden)"
        description="The banner returns null in production — nothing is rendered."
      >
        <EnvironmentBanner environment="production" position="static" />
        <p className="text-sm text-muted-foreground">
          No banner is rendered for production environments.
        </p>
      </DemoSection>

      <DemoSection
        title="With Full Metadata"
        description="All available metadata fields populated. Click the chevron to reveal environment variables."
      >
        <EnvironmentBanner
          environment="staging"
          position="static"
          appName="admin"
          gitBranch="release/v2.1.0"
          gitSha="deadbeefcafe1234567890ab"
          deployedAt={new Date(
            Date.now() - 45 * 60 * 1000
          ).toISOString()}
          buildId="bld_xyz789"
          envVars={sampleEnvVars}
        />
      </DemoSection>

      <DemoSection
        title="Minimal"
        description="Only environment name, no metadata."
      >
        <EnvironmentBanner
          environment="development"
          position="static"
        />
      </DemoSection>
    </>
  );
}
