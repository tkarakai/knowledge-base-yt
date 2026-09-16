"use client";

import { Checkbox, Label } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function CheckboxShowcase() {
  return (
    <>
      <DemoSection title="Basic">
        <div className="flex items-center space-x-2">
          <Checkbox id="terms" />
          <Label htmlFor="terms">Accept terms and conditions</Label>
        </div>
      </DemoSection>

      <DemoSection title="Multiple Options">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox id="cb-email" defaultChecked />
            <Label htmlFor="cb-email">Email notifications</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="cb-sms" />
            <Label htmlFor="cb-sms">SMS notifications</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="cb-push" defaultChecked />
            <Label htmlFor="cb-push">Push notifications</Label>
          </div>
        </div>
      </DemoSection>

      <DemoSection title="Disabled">
        <div className="flex items-center space-x-2">
          <Checkbox id="cb-disabled" disabled />
          <Label htmlFor="cb-disabled" className="text-muted-foreground">
            Disabled checkbox
          </Label>
        </div>
      </DemoSection>
    </>
  );
}
