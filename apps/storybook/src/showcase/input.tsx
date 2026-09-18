"use client";

import { Input, Label } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function InputShowcase() {
  return (
    <>
      <DemoSection title="Default">
        <div className="max-w-sm">
          <Input placeholder="Enter your email" />
        </div>
      </DemoSection>

      <DemoSection title="With Label">
        <div className="max-w-sm space-y-2">
          <Label htmlFor="input-email">Email</Label>
          <Input id="input-email" type="email" placeholder="name@example.com" />
        </div>
      </DemoSection>

      <DemoSection title="Sizes">
        <div className="max-w-sm space-y-4">
          <div className="space-y-2">
            <Label>Small</Label>
            <Input inputSize="sm" placeholder="Small input" />
          </div>
          <div className="space-y-2">
            <Label>Medium (default)</Label>
            <Input inputSize="md" placeholder="Medium input" />
          </div>
          <div className="space-y-2">
            <Label>Large</Label>
            <Input inputSize="lg" placeholder="Large input" />
          </div>
        </div>
      </DemoSection>

      <DemoSection title="Error Variant">
        <div className="max-w-sm space-y-2">
          <Label htmlFor="input-error">Username</Label>
          <Input
            id="input-error"
            variant="error"
            defaultValue="ab"
          />
          <p className="text-xs text-destructive">
            Username must be at least 3 characters.
          </p>
        </div>
      </DemoSection>

      <DemoSection title="Disabled">
        <div className="max-w-sm">
          <Input disabled placeholder="Disabled input" />
        </div>
      </DemoSection>

      <DemoSection title="File Input">
        <div className="max-w-sm space-y-2">
          <Label htmlFor="input-file">Upload file</Label>
          <Input id="input-file" type="file" />
        </div>
      </DemoSection>
    </>
  );
}
