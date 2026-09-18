"use client";

import { Badge } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function BadgeShowcase() {
  return (
    <>
      <DemoSection title="Variants">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </DemoSection>
    </>
  );
}
