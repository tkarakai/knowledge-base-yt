"use client";

import { Label, RadioGroup, RadioGroupItem } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function RadioGroupShowcase() {
  return (
    <>
      <DemoSection title="Default">
        <RadioGroup defaultValue="comfortable">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="default" id="r1" />
            <Label htmlFor="r1">Default</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="comfortable" id="r2" />
            <Label htmlFor="r2">Comfortable</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="compact" id="r3" />
            <Label htmlFor="r3">Compact</Label>
          </div>
        </RadioGroup>
      </DemoSection>

      <DemoSection title="Disabled Option">
        <RadioGroup defaultValue="option-one">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="option-one" id="rd1" />
            <Label htmlFor="rd1">Option One</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="option-two" id="rd2" disabled />
            <Label htmlFor="rd2" className="text-muted-foreground">
              Option Two (disabled)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="option-three" id="rd3" />
            <Label htmlFor="rd3">Option Three</Label>
          </div>
        </RadioGroup>
      </DemoSection>
    </>
  );
}
