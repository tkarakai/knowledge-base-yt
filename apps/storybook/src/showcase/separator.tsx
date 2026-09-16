"use client";

import { Separator } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function SeparatorShowcase() {
  return (
    <>
      <DemoSection title="Horizontal">
        <div className="max-w-md space-y-4">
          <div>
            <h4 className="text-sm font-medium">Section Title</h4>
            <p className="text-sm text-muted-foreground">
              Content above the separator.
            </p>
          </div>
          <Separator />
          <div>
            <h4 className="text-sm font-medium">Another Section</h4>
            <p className="text-sm text-muted-foreground">
              Content below the separator.
            </p>
          </div>
        </div>
      </DemoSection>

      <DemoSection title="Vertical">
        <div className="flex h-5 items-center space-x-4 text-sm">
          <span>Blog</span>
          <Separator orientation="vertical" />
          <span>Docs</span>
          <Separator orientation="vertical" />
          <span>Source</span>
        </div>
      </DemoSection>
    </>
  );
}
