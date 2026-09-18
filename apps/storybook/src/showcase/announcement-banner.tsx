"use client";

import * as React from "react";

import { AnnouncementBanner, Button } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

const LEARN_MORE_HTML = `
  <main style="font-family: Arial, sans-serif; padding: 16px; color: #111827;">
    <h2 style="margin: 0 0 8px;">Public Beta Is Live</h2>
    <p style="margin: 0 0 12px; line-height: 1.5;">
      We launched public beta with shared workspaces, audit trail, and new onboarding modes.
      Visit <a href="{{webAppUrl}}" target="_blank" rel="noopener noreferrer">the app</a>
      or read details on <a href="{{landingPageUrl}}" target="_blank" rel="noopener noreferrer">the landing page</a>.
    </p>
  </main>
`;

export default function AnnouncementBannerShowcase() {
  const [dismissed, setDismissed] = React.useState(false);

  return (
    <>
      <DemoSection
        title="Text Only"
        description="Simple banner with message and dismiss action."
      >
        <AnnouncementBanner
          name="Early Release"
          bannerText="Early release is available for selected users."
          onDismiss={() => undefined}
        />
      </DemoSection>

      <DemoSection
        title="With CTA"
        description="Includes call-to-action button for quick navigation."
      >
        <AnnouncementBanner
          name="Stable Release"
          bannerText="Stable release is now available for all teams."
          callToActionName="Open App"
          callToActionUrl="https://example.com/app"
          onDismiss={() => undefined}
        />
      </DemoSection>

      <DemoSection
        title="With Learn More Modal"
        description="Learn More opens a sandboxed HTML preview dialog."
      >
        <AnnouncementBanner
          name="Public Beta"
          bannerText="Public beta is now open, including new collaboration tools."
          callToActionName="Try It"
          callToActionUrl="https://example.com/beta"
          learnMoreName="Learn More"
          learnMoreContent={LEARN_MORE_HTML}
          onDismiss={() => undefined}
        />
      </DemoSection>

      <DemoSection
        title="Long Content Wrapping"
        description="Banner layout adapts to long text while preserving action controls."
      >
        <AnnouncementBanner
          name="Feature Drop"
          bannerText="We shipped a major update with performance improvements, faster project loading, improved audit history search, and better onboarding controls for invite-only, waitlist, and public signup modes."
          learnMoreName="Release Notes"
          learnMoreContent={LEARN_MORE_HTML}
          onDismiss={() => undefined}
        />
      </DemoSection>

      <DemoSection
        title="Dismissed State Simulation"
        description="Simulate a dismissed banner and bring it back."
        toolbar={
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDismissed((prev) => !prev)}
          >
            {dismissed ? "Show Banner" : "Dismiss Banner"}
          </Button>
        }
      >
        {!dismissed ? (
          <AnnouncementBanner
            name="Session Notice"
            bannerText="This banner can be dismissed for the current session."
            onDismiss={() => setDismissed(true)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Banner dismissed.</p>
        )}
      </DemoSection>
    </>
  );
}
