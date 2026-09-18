"use client";

import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Label,
} from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

// ── Scale data ─────────────────────────────────────────────────────

const spacingScale = [
  { name: "0.5", px: 2 },
  { name: "1", px: 4 },
  { name: "1.5", px: 6 },
  { name: "2", px: 8 },
  { name: "3", px: 12 },
  { name: "4", px: 16 },
  { name: "5", px: 20 },
  { name: "6", px: 24 },
  { name: "8", px: 32 },
  { name: "10", px: 40 },
  { name: "12", px: 48 },
  { name: "16", px: 64 },
  { name: "20", px: 80 },
  { name: "24", px: 96 },
];

// ── Annotation helper ──────────────────────────────────────────────

/** Renders a dashed-border annotation box with a label, highlighting a spacing value */
function SpacingAnnotation({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative mt-3 ${className}`}>
      <div className="absolute -top-2.5 left-2 z-10 whitespace-nowrap px-1" style={{ backgroundColor: "var(--annotation-bg, var(--card))" }}>
        <span className="text-[10px] font-mono font-medium text-primary">
          {label}
        </span>
      </div>
      <div className="rounded border border-dashed border-primary/40 pt-3 px-2 pb-2">
        {children}
      </div>
    </div>
  );
}

// ── Main showcase ──────────────────────────────────────────────────

export default function SpacingShowcase() {
  return (
    <>
      {/* ── Section 1: Scale Reference ─────────────────────────── */}
      <DemoSection
        title="Spacing Scale"
        description="The core spacing values from Tailwind CSS used for padding, margin, gap, and sizing throughout the design system."
      >
        <div className="space-y-2">
          {spacingScale.map(({ name, px }) => (
            <div key={name} className="flex items-center gap-3">
              <div className="w-16 shrink-0 text-right">
                <span className="text-xs font-mono text-muted-foreground">
                  {name}
                </span>
              </div>
              <div className="w-14 shrink-0">
                <span className="text-xs text-muted-foreground/60">
                  {px}px
                </span>
              </div>
              <div
                className="h-3 bg-primary"
                style={{ width: `${px}px` }}
              />
            </div>
          ))}
        </div>
      </DemoSection>

      {/* ── Section 2: Card Anatomy ────────────────────────────── */}
      <DemoSection
        title="Card Anatomy"
        description="How spacing creates structure inside a Card component. Padding, header gaps, and content separation are all driven by the spacing scale."
      >
        <SpacingAnnotation label="p-6 (24px) — card padding">
          <Card style={{ "--annotation-bg": "var(--card)" } as React.CSSProperties}>
            <CardHeader>
              <SpacingAnnotation label="space-y-1.5 (6px) — title ↔ description">
                <div className="space-y-1.5">
                  <CardTitle>Project Settings</CardTitle>
                  <CardDescription>
                    Manage your project configuration and team access.
                  </CardDescription>
                </div>
              </SpacingAnnotation>
            </CardHeader>
            <CardContent>
              <SpacingAnnotation label="space-y-4 (16px) — form field groups">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="sp-name">Project name</Label>
                    <Input id="sp-name" defaultValue="my-project" readOnly />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sp-desc">Description</Label>
                    <Input
                      id="sp-desc"
                      placeholder="Optional description"
                      readOnly
                    />
                  </div>
                </div>
              </SpacingAnnotation>
            </CardContent>
            <CardFooter>
              <SpacingAnnotation label="gap-2 (8px) — button group">
                <div className="flex gap-2">
                  <Button size="sm">Save</Button>
                  <Button size="sm" variant="ghost">
                    Cancel
                  </Button>
                </div>
              </SpacingAnnotation>
            </CardFooter>
          </Card>
        </SpacingAnnotation>
      </DemoSection>

      {/* ── Section 3: Vertical Rhythm ─────────────────────────── */}
      <DemoSection
        title="Vertical Rhythm"
        description="Consistent vertical spacing creates visual hierarchy. Tighter spacing groups related items; wider spacing separates sections."
      >
        <div className="rounded-lg border border-border/80 bg-card p-6" style={{ "--annotation-bg": "var(--card)" } as React.CSSProperties}>
          <SpacingAnnotation label="space-y-6 (24px) — between sections">
            <div className="space-y-6">
              {/* Section 1 */}
              <div>
                <SpacingAnnotation label="mb-1 (4px) — heading ↔ subheading">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      General
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Basic project information
                    </p>
                  </div>
                </SpacingAnnotation>
                <div className="mt-3">
                  <SpacingAnnotation label="space-y-2 (8px) — list items">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <span className="text-muted-foreground">Name</span>
                        <span className="font-medium">my-project</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant="accent">Active</Badge>
                      </div>
                      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <span className="text-muted-foreground">Region</span>
                        <span className="font-medium">us-east-1</span>
                      </div>
                    </div>
                  </SpacingAnnotation>
                </div>
              </div>

              {/* Section 2 */}
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Team
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  People with access
                </p>
                <div className="mt-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className="text-muted-foreground">
                        alice@acme.com
                      </span>
                      <Badge>Owner</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className="text-muted-foreground">
                        bob@acme.com
                      </span>
                      <Badge variant="secondary">Editor</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SpacingAnnotation>
        </div>
      </DemoSection>

      {/* ── Section 4: Inline Spacing ──────────────────────────── */}
      <DemoSection
        title="Inline Spacing"
        description="Horizontal gaps between elements at different densities. Tighter gaps for related controls, wider gaps for distinct groups."
      >
        <div className="space-y-6">
          {/* Tight: badges / tags */}
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">
              gap-1.5 (6px) — Tags &amp; badges
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">React</Badge>
              <Badge variant="secondary">TypeScript</Badge>
              <Badge variant="secondary">Tailwind</Badge>
              <Badge variant="secondary">Convex</Badge>
              <Badge variant="secondary">Radix</Badge>
            </div>
          </div>

          {/* Standard: button group */}
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">
              gap-2 (8px) — Button groups
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm">Save</Button>
              <Button size="sm" variant="secondary">
                Draft
              </Button>
              <Button size="sm" variant="outline">
                Preview
              </Button>
              <Button size="sm" variant="ghost">
                Cancel
              </Button>
            </div>
          </div>

          {/* Wide: toolbar sections */}
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">
              gap-4 (16px) — Toolbar groups
            </p>
            <div className="flex items-center gap-4 rounded-md border bg-card px-3 py-2">
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost">
                  Cut
                </Button>
                <Button size="sm" variant="ghost">
                  Copy
                </Button>
                <Button size="sm" variant="ghost">
                  Paste
                </Button>
              </div>
              <div className="h-5 w-px bg-border" />
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost">
                  Undo
                </Button>
                <Button size="sm" variant="ghost">
                  Redo
                </Button>
              </div>
              <div className="h-5 w-px bg-border" />
              <Button size="sm" variant="ghost">
                Settings
              </Button>
            </div>
          </div>
        </div>
      </DemoSection>

      {/* ── Section 5: Grid Gaps ───────────────────────────────── */}
      <DemoSection
        title="Grid Gaps"
        description="How gap values affect card grid layouts. Tighter grids feel denser and more data-oriented; wider grids feel more spacious."
      >
        <div className="space-y-6">
          {[
            { gap: "gap-2", label: "gap-2 (8px) — Compact / data-dense" },
            { gap: "gap-4", label: "gap-4 (16px) — Standard card grid" },
            { gap: "gap-6", label: "gap-6 (24px) — Spacious / editorial" },
          ].map(({ gap, label }) => (
            <div key={gap}>
              <p className="mb-2 text-xs font-medium text-foreground">
                {label}
              </p>
              <div className={`grid grid-cols-3 ${gap}`}>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-md border bg-card p-4 text-center"
                  >
                    <p className="text-sm font-medium text-foreground">
                      Card {i}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Content here
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DemoSection>

      {/* ── Section 6: Container Padding ───────────────────────── */}
      <DemoSection
        title="Container Padding"
        description="Padding inside containers controls how content breathes. These are the most common container padding patterns in the design system."
      >
        <div className="space-y-4">
          {[
            {
              pad: "p-3",
              label: "p-3 (12px) — Compact: list items, small cards",
            },
            {
              pad: "p-4",
              label: "p-4 (16px) — Standard: input fields, toolbar items",
            },
            {
              pad: "p-6",
              label: "p-6 (24px) — Comfortable: cards, dialogs, main panels",
            },
            {
              pad: "px-6 py-16",
              label:
                "px-6 py-16 — Page-level: hero sections, marketing layouts",
            },
          ].map(({ pad, label }) => (
            <div key={pad}>
              <p className="mb-2 text-xs font-medium text-foreground">
                {label}
              </p>
              <div
                className={`${pad} rounded-lg border border-dashed border-primary/30 bg-primary/5`}
              >
                <div className="rounded border border-primary/20 bg-primary/10 px-3 py-2">
                  <span className="text-xs font-mono text-primary">
                    {pad}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DemoSection>

      {/* ── Section 7: Spacing Comparison ──────────────────────── */}
      <DemoSection
        title="Spacing Comparison"
        description="The same notification card rendered with different spacing values to show how density affects feel."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            {
              label: "Compact",
              headerPad: "px-3 py-2",
              contentPad: "px-3 pb-2",
              footerPad: "px-3 pb-2",
              titleGap: "space-y-0.5",
              btnSize: "sm" as const,
              footerGap: "gap-1.5",
            },
            {
              label: "Standard",
              headerPad: "p-4",
              contentPad: "px-4 pb-3",
              titleGap: "space-y-1",
              footerPad: "px-4 pb-4",
              btnSize: "sm" as const,
              footerGap: "gap-2",
            },
            {
              label: "Spacious",
              headerPad: "p-6",
              contentPad: "px-6 pb-4",
              titleGap: "space-y-1.5",
              footerPad: "px-6 pb-6",
              btnSize: "md" as const,
              footerGap: "gap-3",
            },
          ].map((variant) => (
            <div key={variant.label}>
              <p className="mb-2 text-xs font-medium text-foreground">
                {variant.label}
              </p>
              <div className="rounded-lg border border-border/80 bg-card shadow-sm">
                <div className={variant.headerPad}>
                  <div className={variant.titleGap}>
                    <h4 className="text-sm font-semibold">New deployment</h4>
                    <p className="text-xs text-muted-foreground">
                      Deployed 3 min ago
                    </p>
                  </div>
                </div>
                <div className={variant.contentPad}>
                  <p className="text-xs text-muted-foreground">
                    Build completed in 42s with 0 errors.
                  </p>
                </div>
                <div className={variant.footerPad}>
                  <div className={`flex ${variant.footerGap}`}>
                    <Button size={variant.btnSize}>View</Button>
                    <Button size={variant.btnSize} variant="ghost">
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DemoSection>
    </>
  );
}
