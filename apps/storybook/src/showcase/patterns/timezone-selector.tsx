"use client";

import * as React from "react";
import { TimezoneSelector, Label } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function TimezoneSelectorShowcase() {
  const [value1, setValue1] = React.useState("");
  const [value2, setValue2] = React.useState("Europe/London");
  const [value3, setValue3] = React.useState("");
  const [value4, setValue4] = React.useState("America/New_York");

  return (
    <>
      <DemoSection
        title="Default"
        description="A searchable timezone selector with auto-detected timezone, curated timezones grouped by region, and live UTC offsets. Used in user profile settings to let users pick their timezone."
      >
        <div className="max-w-sm space-y-2">
          <Label>Timezone</Label>
          <TimezoneSelector value={value1} onValueChange={setValue1} />
        </div>
      </DemoSection>

      <DemoSection
        title="Pre-selected Value"
        description="When the user already has a saved timezone, the selector shows the label with its current UTC offset."
      >
        <div className="max-w-sm space-y-2">
          <Label>Timezone</Label>
          <TimezoneSelector value={value2} onValueChange={setValue2} />
        </div>
      </DemoSection>

      <DemoSection
        title="Custom Labels"
        description="All user-facing strings are customizable for internationalization — placeholder, search hint, detected label, and no-results text."
      >
        <div className="max-w-sm space-y-2">
          <Label>Timezone</Label>
          <TimezoneSelector
            value={value3}
            onValueChange={setValue3}
            placeholder="Choose your timezone..."
            searchPlaceholder="Type to search..."
            detectedLabel="Auto-detected"
            noResultsText="Nothing matches your search."
          />
        </div>
      </DemoSection>

      <DemoSection
        title="Disabled"
        description="The selector can be disabled to prevent interaction while preserving the selected value."
      >
        <div className="max-w-sm space-y-2">
          <Label>Timezone</Label>
          <TimezoneSelector
            value={value4}
            onValueChange={setValue4}
            disabled
          />
        </div>
      </DemoSection>
    </>
  );
}
