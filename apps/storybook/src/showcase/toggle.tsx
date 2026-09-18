"use client";

import { Bold, Italic, Underline } from "lucide-react";
import { Toggle } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

export default function ToggleShowcase() {
  return (
    <>
      <DemoSection title="Basic Toggle">
        <div className="flex flex-wrap items-center gap-3">
          <Toggle aria-label="Toggle bold">
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle aria-label="Toggle italic">
            <Italic className="h-4 w-4" />
          </Toggle>
          <Toggle aria-label="Toggle underline">
            <Underline className="h-4 w-4" />
          </Toggle>
        </div>
      </DemoSection>

      <DemoSection title="With Text">
        <div className="flex flex-wrap items-center gap-3">
          <Toggle aria-label="Toggle bold">
            <Bold className="h-4 w-4" />
            Bold
          </Toggle>
          <Toggle aria-label="Toggle italic">
            <Italic className="h-4 w-4" />
            Italic
          </Toggle>
        </div>
      </DemoSection>

      <DemoSection title="Outline Variant">
        <div className="flex flex-wrap items-center gap-3">
          <Toggle variant="outline" aria-label="Toggle bold">
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle variant="outline" aria-label="Toggle italic">
            <Italic className="h-4 w-4" />
          </Toggle>
        </div>
      </DemoSection>

      <DemoSection title="Sizes">
        <div className="flex flex-wrap items-center gap-3">
          <Toggle size="sm" aria-label="Small">
            <Bold className="h-3.5 w-3.5" />
          </Toggle>
          <Toggle size="md" aria-label="Medium">
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle size="lg" aria-label="Large">
            <Bold className="h-5 w-5" />
          </Toggle>
        </div>
      </DemoSection>

      <DemoSection title="Disabled">
        <div className="flex flex-wrap items-center gap-3">
          <Toggle disabled aria-label="Disabled">
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle variant="outline" disabled aria-label="Disabled outline">
            <Italic className="h-4 w-4" />
          </Toggle>
        </div>
      </DemoSection>
    </>
  );
}
