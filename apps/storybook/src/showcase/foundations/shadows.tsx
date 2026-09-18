"use client";

import { DemoSection } from "@/components/demo-section";

const shadowLevels = [
  { cls: "shadow-sm", label: "shadow-sm" },
  { cls: "shadow", label: "shadow" },
  { cls: "shadow-md", label: "shadow-md" },
  { cls: "shadow-lg", label: "shadow-lg" },
  { cls: "shadow-xl", label: "shadow-xl" },
  { cls: "shadow-2xl", label: "shadow-2xl" },
];

export default function ShadowsShowcase() {
  return (
    <>
      <DemoSection
        title="Elevation Scale"
        description="Increasing shadow intensity for layered surfaces. Each step adds more depth and separation from the background."
      >
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {shadowLevels.map(({ cls, label }) => (
            <div key={cls} className="flex flex-col items-center gap-3">
              <div
                className={`${cls} h-24 w-full rounded-lg bg-card border border-border/20`}
              />
              <span className="text-xs font-mono text-muted-foreground">
                {label}
              </span>
            </div>
          ))}
        </div>
      </DemoSection>

      <DemoSection
        title="No Shadow"
        description="The shadow-none utility removes all shadows, useful for resetting inherited elevation."
      >
        <div className="flex flex-col items-center gap-3">
          <div className="shadow-none h-24 w-full max-w-xs rounded-lg bg-card border border-border/20" />
          <span className="text-xs font-mono text-muted-foreground">
            shadow-none
          </span>
        </div>
      </DemoSection>
    </>
  );
}
