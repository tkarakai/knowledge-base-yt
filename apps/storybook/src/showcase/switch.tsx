"use client";

import { Label, Switch } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function SwitchShowcase() {
  return (
    <>
      <DemoSection title="Default">
        <div className="flex items-center space-x-2">
          <Switch id="airplane-mode" />
          <Label htmlFor="airplane-mode">Airplane Mode</Label>
        </div>
      </DemoSection>

      <DemoSection title="Settings List">
        <div className="max-w-sm space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="sw-notifications">Notifications</Label>
            <Switch id="sw-notifications" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sw-marketing">Marketing emails</Label>
            <Switch id="sw-marketing" />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sw-security" className="text-muted-foreground">
              Security alerts (required)
            </Label>
            <Switch id="sw-security" defaultChecked disabled />
          </div>
        </div>
      </DemoSection>
    </>
  );
}
