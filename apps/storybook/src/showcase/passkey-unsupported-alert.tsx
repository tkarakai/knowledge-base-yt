"use client";

import { PasskeyUnsupportedAlert } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function PasskeyUnsupportedAlertShowcase() {
  return (
    <>
      <DemoSection
        title="Default"
        description="Amber info block shown when the browser does not support passkeys (WebAuthn). Uses default title and description."
      >
        <PasskeyUnsupportedAlert />
      </DemoSection>

      <DemoSection
        title="Custom Text"
        description="Title and description can be overridden via props for different contexts."
      >
        <PasskeyUnsupportedAlert
          title="Passkeys are not available"
          description="Your current browser does not support WebAuthn. Please use a modern browser such as Chrome, Safari, Firefox, or Edge to register a passkey."
        />
      </DemoSection>

      <DemoSection
        title="Compact (Settings Context)"
        description="A shorter message suitable for inline use in settings panels."
      >
        <div className="max-w-2xl">
          <PasskeyUnsupportedAlert
            title="Passkeys aren't supported on this device or browser."
            description="Sign in from a device that supports passkeys to add one."
          />
        </div>
      </DemoSection>
    </>
  );
}
