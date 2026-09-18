"use client";

import { useState } from "react";
import { DemoSection } from "@/components/demo-section";

const sampleText = "The quick brown fox jumps over the lazy dog";

const textSizes = [
  { cls: "text-xs", label: "xs", size: "0.75rem / 12px" },
  { cls: "text-sm", label: "sm", size: "0.875rem / 14px" },
  { cls: "text-base", label: "base", size: "1rem / 16px" },
  { cls: "text-lg", label: "lg", size: "1.125rem / 18px" },
  { cls: "text-xl", label: "xl", size: "1.25rem / 20px" },
  { cls: "text-2xl", label: "2xl", size: "1.5rem / 24px" },
  { cls: "text-3xl", label: "3xl", size: "1.875rem / 30px" },
  { cls: "text-4xl", label: "4xl", size: "2.25rem / 36px" },
  { cls: "text-5xl", label: "5xl", size: "3rem / 48px" },
  { cls: "text-6xl", label: "6xl", size: "3.75rem / 60px" },
];

const fontWeights = [
  { cls: "font-light", label: "Light", weight: "300" },
  { cls: "font-normal", label: "Normal", weight: "400" },
  { cls: "font-medium", label: "Medium", weight: "500" },
  { cls: "font-semibold", label: "Semibold", weight: "600" },
  { cls: "font-bold", label: "Bold", weight: "700" },
];

const trackingValues = [
  { cls: "tracking-tighter", label: "Tighter", value: "-0.05em" },
  { cls: "tracking-tight", label: "Tight", value: "-0.025em" },
  { cls: "tracking-normal", label: "Normal", value: "0em" },
  { cls: "tracking-wide", label: "Wide", value: "0.025em" },
  { cls: "tracking-wider", label: "Wider", value: "0.05em" },
  { cls: "tracking-widest", label: "Widest", value: "0.1em" },
];

const leadingValues = [
  { cls: "leading-none", label: "None", value: "1" },
  { cls: "leading-tight", label: "Tight", value: "1.25" },
  { cls: "leading-snug", label: "Snug", value: "1.375" },
  { cls: "leading-normal", label: "Normal", value: "1.5" },
  { cls: "leading-relaxed", label: "Relaxed", value: "1.625" },
  { cls: "leading-loose", label: "Loose", value: "2" },
];

const multiLineText =
  "Design is not just what it looks like and feels like. Design is how it works. Good design is as little design as possible.";

function OverflowToggle({
  mode,
  onChange,
}: {
  mode: "truncate" | "wrap";
  onChange: (mode: "truncate" | "wrap") => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 p-0.5 text-xs">
      <button
        type="button"
        onClick={() => onChange("truncate")}
        className={`rounded px-2 py-0.5 transition-colors ${
          mode === "truncate"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Truncate
      </button>
      <button
        type="button"
        onClick={() => onChange("wrap")}
        className={`rounded px-2 py-0.5 transition-colors ${
          mode === "wrap"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Wrap
      </button>
    </div>
  );
}

export default function TypographyShowcase() {
  const [overflowMode, setOverflowMode] = useState<"truncate" | "wrap">(
    "wrap"
  );

  const textOverflowClass =
    overflowMode === "truncate" ? "truncate" : "break-words";

  return (
    <>
      <DemoSection
        title="Font Family"
        description="The primary typeface loaded via Google Fonts and applied through the --font-sans CSS variable."
      >
        <div className="space-y-4">
          <p className="text-2xl font-light text-foreground break-words">
            {sampleText}
          </p>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-mono break-all">
              --font-sans: Raleway, ui-sans-serif, system-ui, sans-serif
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              font-family: var(--font-sans)
            </p>
          </div>
        </div>
      </DemoSection>

      <DemoSection
        title="Text Sizes"
        description="Tailwind's typographic scale from xs to 6xl."
        toolbar={
          <OverflowToggle mode={overflowMode} onChange={setOverflowMode} />
        }
      >
        <div className={"space-y-4"}>
          {textSizes.map(({ cls, label, size }) => (
            <div key={cls} className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-mono text-muted-foreground">
                  {label}
                </span>
                <span className="text-xs text-muted-foreground/60">
                  {size}
                </span>
              </div>
              <p
                className={`${cls} text-foreground ${textOverflowClass} min-w-0`}
              >
                {sampleText}
              </p>
            </div>
          ))}
        </div>
      </DemoSection>

      <DemoSection
        title="Font Weights"
        description="Available weight variations for the Raleway font family."
        toolbar={
          <OverflowToggle mode={overflowMode} onChange={setOverflowMode} />
        }
      >
        <div className={"space-y-3"}>
          {fontWeights.map(({ cls, label, weight }) => (
            <div key={cls} className="space-y-1">
              <span className="text-xs font-mono text-muted-foreground">
                {weight}
              </span>
              <p
                className={`${cls} text-lg text-foreground ${textOverflowClass} min-w-0`}
              >
                {label} — {sampleText}
              </p>
            </div>
          ))}
        </div>
      </DemoSection>

      <DemoSection
        title="Letter Spacing (Tracking)"
        description="Adjustments to the space between characters."
        toolbar={
          <OverflowToggle mode={overflowMode} onChange={setOverflowMode} />
        }
      >
        <div className={"space-y-3"}>
          {trackingValues.map(({ cls, label, value }) => (
            <div key={cls} className="space-y-1">
              <span className="text-xs font-mono text-muted-foreground">
                {value}
              </span>
              <p
                className={`${cls} text-base text-foreground ${textOverflowClass} min-w-0`}
              >
                {label} — {sampleText}
              </p>
            </div>
          ))}
        </div>
      </DemoSection>

      <DemoSection
        title="Line Height (Leading)"
        description="Controls the vertical space between lines of text."
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {leadingValues.map(({ cls, label, value }) => (
            <div key={cls} className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-foreground">
                  {label}
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  {value}
                </span>
              </div>
              <p
                className={`${cls} text-sm text-muted-foreground border-l-2 border-primary/20 pl-3`}
              >
                {multiLineText}
              </p>
            </div>
          ))}
        </div>
      </DemoSection>
    </>
  );
}
