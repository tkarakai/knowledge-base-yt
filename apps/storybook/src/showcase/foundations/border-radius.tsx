"use client";

import { useEffect, useState } from "react";
import { Button } from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

const radiusSizes = [
  {
    cls: "rounded-sm",
    label: "sm",
    variable: "--radius-sm",
    definition: "calc(var(--radius) - 4px)",
  },
  {
    cls: "rounded-md",
    label: "md",
    variable: "--radius-md",
    definition: "calc(var(--radius) - 2px)",
  },
  {
    cls: "rounded-lg",
    label: "lg",
    variable: "--radius-lg",
    definition: "var(--radius)",
  },
  {
    cls: "rounded-xl",
    label: "xl",
    variable: "--radius-xl",
    definition: "calc(var(--radius) + 4px)",
  },
  {
    cls: "rounded-full",
    label: "full",
    variable: null,
    definition: "9999px",
  },
];

const buttonSizes = [
  { size: "sm" as const, label: "Small" },
  { size: "md" as const, label: "Medium" },
  { size: "lg" as const, label: "Large" },
];

const radiusClasses = [
  { cls: "rounded-none", label: "none" },
  { cls: "rounded-sm", label: "sm" },
  { cls: "rounded-md", label: "md (default)" },
  { cls: "rounded-lg", label: "lg" },
  { cls: "rounded-xl", label: "xl" },
  { cls: "rounded-full", label: "full" },
];

function useComputedRadii(): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const style = window.getComputedStyle(document.documentElement);
    const result: Record<string, string> = {};

    for (const { variable } of radiusSizes) {
      if (variable) {
        result[variable] = style.getPropertyValue(variable).trim();
      }
    }

    // Also read the base --radius
    result["--radius"] = style.getPropertyValue("--radius").trim();

    setValues(result);
  }, []);

  return values;
}

export default function BorderRadiusShowcase() {
  const computed = useComputedRadii();

  return (
    <>
      <DemoSection
        title="Radius Scale"
        description={`Base radius: --radius = ${computed["--radius"] || "0.625rem"} (10px). All other sizes are derived from this base value.`}
      >
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {radiusSizes.map(({ cls, label, variable, definition }) => (
            <div key={cls} className="flex flex-col items-center gap-3">
              <div
                className={`${cls} h-20 w-20 bg-primary`}
              />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {label}
                </p>
                <p className="text-xs font-mono text-muted-foreground">
                  {definition}
                </p>
                {variable && computed[variable] && (
                  <p className="text-xs text-muted-foreground/60">
                    = {computed[variable]}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </DemoSection>

      <DemoSection
        title="Buttons × Sizes × Radii"
        description="Every combination of button size and border radius."
      >
        <div className="space-y-6">
          {buttonSizes.map(({ size, label }) => (
            <div key={size} className="space-y-2">
              <p className="text-xs font-medium text-foreground">
                {label}{" "}
                <span className="font-mono text-muted-foreground">
                  size=&quot;{size}&quot;
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {radiusClasses.map(({ cls, label: rLabel }) => (
                  <div key={cls} className="flex flex-col items-center gap-1.5">
                    <Button size={size} className={cls}>
                      Button
                    </Button>
                    <span className="text-[10px] font-mono text-muted-foreground/60">
                      {rLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DemoSection>

      <DemoSection
        title="Applied to Components"
        description="How the radius scale looks when applied to common UI elements."
      >
        <div className="space-y-4">
          {radiusSizes.slice(0, 4).map(({ cls, label }) => (
            <div key={cls} className="flex items-center gap-4">
              <span className="w-8 text-xs font-mono text-muted-foreground text-right shrink-0">
                {label}
              </span>
              <div
                className={`${cls} flex-1 h-10 bg-muted border border-border flex items-center px-3`}
              >
                <span className="text-sm text-muted-foreground">
                  Input field with rounded-{label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </DemoSection>
    </>
  );
}
