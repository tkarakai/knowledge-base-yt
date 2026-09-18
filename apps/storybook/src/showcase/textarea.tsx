"use client";

import * as React from "react";
import { Label, Textarea } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function TextareaShowcase() {
  const [value, setValue] = React.useState("");
  const maxLength = 200;

  return (
    <>
      <DemoSection title="Default">
        <div className="max-w-sm">
          <Textarea placeholder="Write your message..." />
        </div>
      </DemoSection>

      <DemoSection title="With Label">
        <div className="max-w-sm space-y-2">
          <Label htmlFor="ta-bio">Bio</Label>
          <Textarea id="ta-bio" placeholder="Tell us about yourself..." />
        </div>
      </DemoSection>

      <DemoSection title="Sizes">
        <div className="max-w-sm space-y-4">
          <div className="space-y-2">
            <Label>Small</Label>
            <Textarea textareaSize="sm" placeholder="Small textarea" />
          </div>
          <div className="space-y-2">
            <Label>Medium (default)</Label>
            <Textarea textareaSize="md" placeholder="Medium textarea" />
          </div>
          <div className="space-y-2">
            <Label>Large</Label>
            <Textarea textareaSize="lg" placeholder="Large textarea" />
          </div>
        </div>
      </DemoSection>

      <DemoSection title="Character Count">
        <div className="max-w-sm space-y-2">
          <Label htmlFor="ta-limited">
            Description (max {maxLength} characters)
          </Label>
          <Textarea
            id="ta-limited"
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, maxLength))}
            placeholder="Write a short description..."
          />
          <p className="text-xs text-muted-foreground text-right">
            {value.length}/{maxLength}
          </p>
        </div>
      </DemoSection>

      <DemoSection title="Error Variant">
        <div className="max-w-sm space-y-2">
          <Label htmlFor="ta-error">Description</Label>
          <Textarea
            id="ta-error"
            variant="error"
            defaultValue="Too short"
          />
          <p className="text-xs text-destructive">
            Description must be at least 20 characters.
          </p>
        </div>
      </DemoSection>

      <DemoSection title="Disabled">
        <div className="max-w-sm">
          <Textarea disabled placeholder="This textarea is disabled" />
        </div>
      </DemoSection>
    </>
  );
}
