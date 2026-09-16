"use client";

import * as React from "react";
import { OtpInput, toast } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function OtpInputShowcase() {
  const [value6, setValue6] = React.useState("");
  const [value4, setValue4] = React.useState("");
  const [value5, setValue5] = React.useState("");
  const [value8, setValue8] = React.useState("");
  const [valueAutoSubmit, setValueAutoSubmit] = React.useState("");
  const [submittedCode, setSubmittedCode] = React.useState<string | null>(null);
  const [valueError, setValueError] = React.useState("12");
  const [valueDisabled] = React.useState("384");

  return (
    <>
      <DemoSection
        title="Default (6 digits)"
        description="Standard 6-digit OTP input with auto-advance and paste support. Without autoSubmit, the filled code stays put."
      >
        <div className="space-y-3">
          <OtpInput
            value={value6}
            onChange={setValue6}
            autoFocus
          />
          <p className="text-center text-xs text-muted-foreground">
            Value: {value6 || "(empty)"}
          </p>
        </div>
      </DemoSection>

      <DemoSection
        title="4 Digits"
        description="Shorter codes for PIN-style inputs."
      >
        <div className="space-y-3">
          <OtpInput
            length={4}
            value={value4}
            onChange={setValue4}
          />
          <p className="text-center text-xs text-muted-foreground">
            Value: {value4 || "(empty)"}
          </p>
        </div>
      </DemoSection>

      <DemoSection
        title="5 Digits (odd)"
        description="Odd digit count — the separator splits 2 – 3."
      >
        <div className="space-y-3">
          <OtpInput
            length={5}
            value={value5}
            onChange={setValue5}
          />
          <p className="text-center text-xs text-muted-foreground">
            Value: {value5 || "(empty)"}
          </p>
        </div>
      </DemoSection>

      <DemoSection
        title="8 Digits"
        description="Longer codes — the separator splits 4 – 4."
      >
        <div className="space-y-3">
          <OtpInput
            length={8}
            value={value8}
            onChange={setValue8}
          />
          <p className="text-center text-xs text-muted-foreground">
            Value: {value8 || "(empty)"}
          </p>
        </div>
      </DemoSection>

      <DemoSection
        title="Auto-submit"
        description="With autoSubmit, typing the last digit fires onComplete, then the field clears and cursor resets to the first digit."
      >
        <div className="space-y-3">
          <OtpInput
            value={valueAutoSubmit}
            onChange={setValueAutoSubmit}
            autoSubmit
            onComplete={(code) => {
              setSubmittedCode(code);
              toast.success(`Submitted code: ${code}`);
              setTimeout(() => setSubmittedCode(null), 3000);
            }}
          />
          {submittedCode ? (
            <div className="mx-auto flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400 w-fit">
              <span className="font-medium">Submitted:</span>
              <code className="font-mono">{submittedCode}</code>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Type all 6 digits — the field auto-submits, clears, and resets cursor.
            </p>
          )}
        </div>
      </DemoSection>

      <DemoSection
        title="Error state"
        description="Visual feedback when verification fails."
      >
        <OtpInput
          value={valueError}
          onChange={setValueError}
          error
        />
      </DemoSection>

      <DemoSection
        title="Disabled"
        description="Non-interactive state while loading."
      >
        <OtpInput
          value={valueDisabled}
          onChange={() => {}}
          disabled
        />
      </DemoSection>
    </>
  );
}
