"use client";

import { useEffect, useState } from "react";
import { Info, AlertCircle } from "lucide-react";
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
  Alert,
  AlertTitle,
  AlertDescription,
} from "@repo/design-system";
import { DemoSection } from "@/components/demo-section";

// ── Color definitions ──────────────────────────────────────────────
// Static OKLCH values from tokens/index.css — used for display labels only.
// Actual rendering always uses var(--token-name) for theme reactivity.

interface ColorToken {
  name: string;
  light: string;
  dark: string;
}

const brandColors: ColorToken[] = [
  { name: "primary", light: "oklch(0.6 0.1 185)", dark: "oklch(0.7 0.12 183)" },
  { name: "primary-foreground", light: "oklch(0.98 0.01 181)", dark: "oklch(0.28 0.04 193)" },
];

const surfaceColors: ColorToken[] = [
  { name: "background", light: "oklch(1 0 0)", dark: "oklch(0.147 0.004 49.25)" },
  { name: "foreground", light: "oklch(0.147 0.004 49.25)", dark: "oklch(0.985 0.001 106.423)" },
  { name: "card", light: "oklch(1 0 0)", dark: "oklch(0.216 0.006 56.043)" },
  { name: "card-foreground", light: "oklch(0.147 0.004 49.25)", dark: "oklch(0.985 0.001 106.423)" },
  { name: "popover", light: "oklch(1 0 0)", dark: "oklch(0.216 0.006 56.043)" },
  { name: "popover-foreground", light: "oklch(0.147 0.004 49.25)", dark: "oklch(0.985 0.001 106.423)" },
];

const stateColors: ColorToken[] = [
  { name: "secondary", light: "oklch(0.967 0.001 286.375)", dark: "oklch(0.274 0.006 286.033)" },
  { name: "secondary-foreground", light: "oklch(0.21 0.006 285.885)", dark: "oklch(0.985 0 0)" },
  { name: "accent", light: "oklch(0.93 0.005 106.424)", dark: "oklch(0.3 0.01 34.298)" },
  { name: "accent-foreground", light: "oklch(0.216 0.006 56.043)", dark: "oklch(0.985 0.001 106.423)" },
  { name: "muted", light: "oklch(0.96 0.002 106.424)", dark: "oklch(0.268 0.007 34.298)" },
  { name: "muted-foreground", light: "oklch(0.553 0.013 58.071)", dark: "oklch(0.709 0.01 56.259)" },
  { name: "destructive", light: "oklch(0.577 0.245 27.325)", dark: "oklch(0.704 0.191 22.216)" },
  { name: "destructive-foreground", light: "oklch(0.985 0 0)", dark: "oklch(0.985 0 0)" },
];

const utilityColors: ColorToken[] = [
  { name: "border", light: "oklch(0.923 0.003 48.717)", dark: "oklch(1 0 0 / 10%)" },
  { name: "input", light: "oklch(0.923 0.003 48.717)", dark: "oklch(1 0 0 / 15%)" },
  { name: "ring", light: "oklch(0.709 0.01 56.259)", dark: "oklch(0.553 0.013 58.071)" },
];

const chartColors: ColorToken[] = [
  { name: "chart-1", light: "oklch(0.85 0.13 181)", dark: "oklch(0.85 0.13 181)" },
  { name: "chart-2", light: "oklch(0.78 0.13 182)", dark: "oklch(0.78 0.13 182)" },
  { name: "chart-3", light: "oklch(0.7 0.12 183)", dark: "oklch(0.7 0.12 183)" },
  { name: "chart-4", light: "oklch(0.6 0.1 185)", dark: "oklch(0.6 0.1 185)" },
  { name: "chart-5", light: "oklch(0.51 0.09 186)", dark: "oklch(0.51 0.09 186)" },
];

const sidebarColors: ColorToken[] = [
  { name: "sidebar", light: "oklch(0.985 0.001 106.423)", dark: "oklch(0.216 0.006 56.043)" },
  { name: "sidebar-foreground", light: "oklch(0.147 0.004 49.25)", dark: "oklch(0.985 0.001 106.423)" },
  { name: "sidebar-primary", light: "oklch(0.6 0.1 185)", dark: "oklch(0.78 0.13 182)" },
  { name: "sidebar-primary-foreground", light: "oklch(0.98 0.01 181)", dark: "oklch(0.28 0.04 193)" },
  { name: "sidebar-accent", light: "oklch(0.93 0.005 106.424)", dark: "oklch(0.3 0.01 34.298)" },
  { name: "sidebar-accent-foreground", light: "oklch(0.216 0.006 56.043)", dark: "oklch(0.985 0.001 106.423)" },
  { name: "sidebar-border", light: "oklch(0.923 0.003 48.717)", dark: "oklch(1 0 0 / 10%)" },
  { name: "sidebar-ring", light: "oklch(0.709 0.01 56.259)", dark: "oklch(0.553 0.013 58.071)" },
];

// ── Token groups for compact reference ─────────────────────────────

interface TokenGroup {
  label: string;
  tokens: ColorToken[];
}

const tokenGroups: TokenGroup[] = [
  { label: "Surfaces", tokens: surfaceColors },
  {
    label: "Brand & Semantic",
    tokens: [
      ...brandColors,
      stateColors[0]!, stateColors[1]!, // secondary pair
      stateColors[6]!, stateColors[7]!, // destructive pair
    ],
  },
  {
    label: "Subtle",
    tokens: [
      stateColors[2]!, stateColors[3]!, // accent pair
      stateColors[4]!, stateColors[5]!, // muted pair
    ],
  },
  { label: "Utility", tokens: utilityColors },
  { label: "Chart", tokens: chartColors },
  { label: "Sidebar", tokens: sidebarColors },
];

// ── Readability pairings ───────────────────────────────────────────

interface TokenPairing {
  bg: string;
  fg: string;
  label: string;
}

const readabilityPairings: TokenPairing[] = [
  { bg: "background", fg: "foreground", label: "Default" },
  { bg: "card", fg: "card-foreground", label: "Card" },
  { bg: "popover", fg: "popover-foreground", label: "Popover" },
  { bg: "primary", fg: "primary-foreground", label: "Primary" },
  { bg: "secondary", fg: "secondary-foreground", label: "Secondary" },
  { bg: "accent", fg: "accent-foreground", label: "Accent" },
  { bg: "muted", fg: "muted-foreground", label: "Muted" },
  { bg: "destructive", fg: "destructive-foreground", label: "Destructive" },
  { bg: "background", fg: "muted-foreground", label: "Hint on page" },
  { bg: "card", fg: "muted-foreground", label: "Hint on card" },
];

// ── Adjacency data ─────────────────────────────────────────────────

const adjacencyPairs: TokenPairing[] = [
  { bg: "primary", fg: "primary-foreground", label: "Primary" },
  { bg: "secondary", fg: "secondary-foreground", label: "Secondary" },
  { bg: "accent", fg: "accent-foreground", label: "Accent" },
  { bg: "muted", fg: "muted-foreground", label: "Muted" },
  { bg: "destructive", fg: "destructive-foreground", label: "Destructive" },
];

const surfaceTokens = [
  { bg: "background", label: "Background" },
  { bg: "card", label: "Card" },
  { bg: "popover", label: "Popover" },
  { bg: "muted", label: "Muted" },
  { bg: "accent", label: "Accent" },
  { bg: "secondary", label: "Secondary" },
];

const textOnSurfaces = [
  { fg: "foreground", label: "foreground" },
  { fg: "muted-foreground", label: "muted-fg" },
  { fg: "primary", label: "primary" },
];

// ── Chart segments ─────────────────────────────────────────────────

const chartSegments = [
  { token: "chart-1", width: 30 },
  { token: "chart-2", width: 25 },
  { token: "chart-3", width: 20 },
  { token: "chart-4", width: 15 },
  { token: "chart-5", width: 10 },
];

// ── Hooks ──────────────────────────────────────────────────────────

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    function check() {
      setIsDark(document.documentElement.classList.contains("dark"));
    }
    check();

    const observer = new window.MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

// ── Sub-components ─────────────────────────────────────────────────

function CompactSwatch({
  token,
  isDark,
}: {
  token: ColorToken;
  isDark: boolean;
}) {
  const definition = isDark ? token.dark : token.light;
  const short = token.name
    .replace("sidebar-", "sb-")
    .replace("-foreground", "-fg");

  return (
    <div
      className="flex flex-col items-center gap-1.5"
      title={`--${token.name}: ${definition}`}
    >
      <div
        className="h-9 w-9 rounded-full border border-border/40 shadow-sm"
        style={{ backgroundColor: `var(--${token.name})` }}
      />
      <span className="w-16 text-center text-[10px] font-mono leading-tight text-muted-foreground">
        {short}
      </span>
    </div>
  );
}

function CompactTokenGroup({
  group,
  isDark,
}: {
  group: TokenGroup;
  isDark: boolean;
}) {
  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {group.label}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {group.tokens.map((token) => (
          <CompactSwatch key={token.name} token={token} isDark={isDark} />
        ))}
      </div>
    </div>
  );
}

function ReadabilityCell({ pairing }: { pairing: TokenPairing }) {
  return (
    <div className="space-y-1.5">
      <div
        className="flex flex-col justify-center gap-1 rounded-lg border border-border/40 px-4 py-3 shadow-sm"
        style={{
          backgroundColor: `var(--${pairing.bg})`,
          color: `var(--${pairing.fg})`,
        }}
      >
        <span className="text-lg font-semibold leading-tight">Heading</span>
        <span className="text-sm font-medium">Body text</span>
        <span className="text-xs">The quick brown fox jumps over the lazy dog</span>
      </div>
      <p className="text-[10px] font-mono text-muted-foreground">
        {pairing.label}{" "}
        <span className="text-muted-foreground/50">
          {pairing.fg} / {pairing.bg}
        </span>
      </p>
    </div>
  );
}

function VignetteLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

// ── Main showcase ──────────────────────────────────────────────────

export default function ColorsShowcase() {
  const isDark = useIsDark();

  return (
    <>
      {/* ── Section 1: Token Reference ─────────────────────────── */}
      <DemoSection
        title="Token Reference"
        description="All semantic color tokens grouped by purpose. Hover any swatch for its OKLCH definition."
      >
        <div className="space-y-5">
          {tokenGroups.map((group) => (
            <CompactTokenGroup
              key={group.label}
              group={group}
              isDark={isDark}
            />
          ))}
        </div>
      </DemoSection>

      {/* ── Section 2: Surface Nesting ─────────────────────────── */}
      <DemoSection
        title="Surface Nesting"
        description="Color tokens create visual hierarchy through layered surfaces. Background contains Card, which contains Popover."
      >
        <div className="space-y-6">
          <div
            className="rounded-xl border border-border/40 p-6 sm:p-8"
            style={{ backgroundColor: "var(--background)" }}
          >
            <p
              className="text-xs font-mono mb-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              --background
            </p>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--foreground)" }}
            >
              Page-level surface
            </p>
            <div
              className="rounded-lg border shadow-sm p-5 sm:p-6"
              style={{
                backgroundColor: "var(--card)",
                borderColor: "var(--border)",
              }}
            >
              <p
                className="text-xs font-mono mb-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                --card
              </p>
              <p
                className="text-sm mb-4"
                style={{ color: "var(--card-foreground)" }}
              >
                Elevated card surface
              </p>
              <div
                className="rounded-md border shadow-md p-4"
                style={{
                  backgroundColor: "var(--popover)",
                  borderColor: "var(--border)",
                }}
              >
                <p
                  className="text-xs font-mono mb-1"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  --popover
                </p>
                <p
                  className="text-sm"
                  style={{ color: "var(--popover-foreground)" }}
                >
                  Floating popover surface
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar vs Background */}
          <div className="flex overflow-hidden rounded-lg border border-border/40">
            <div
              className="flex-1 p-4"
              style={{
                backgroundColor: "var(--sidebar)",
                color: "var(--sidebar-foreground)",
              }}
            >
              <p className="text-xs font-mono mb-1 opacity-60">--sidebar</p>
              <p className="text-sm font-medium">Sidebar</p>
            </div>
            <div
              className="flex-1 border-l p-4"
              style={{
                backgroundColor: "var(--background)",
                color: "var(--foreground)",
                borderColor: "var(--border)",
              }}
            >
              <p className="text-xs font-mono mb-1 opacity-60">--background</p>
              <p className="text-sm font-medium">Main content</p>
            </div>
          </div>
        </div>
      </DemoSection>

      {/* ── Section 3: Text Readability ────────────────────────── */}
      <DemoSection
        title="Text Readability"
        description="Each foreground token on its paired background at multiple text sizes. Every combination should remain legible."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {readabilityPairings.map((pairing) => (
            <ReadabilityCell key={`${pairing.bg}-${pairing.fg}`} pairing={pairing} />
          ))}
        </div>
      </DemoSection>

      {/* ── Section 4: Component Vignettes ─────────────────────── */}
      <DemoSection
        title="Component Vignettes"
        description="Realistic UI patterns built from color tokens. These demonstrate how tokens combine in real components."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Notification */}
          <div>
            <VignetteLabel>Notification</VignetteLabel>
            <Card>
              <CardHeader>
                <CardTitle>New deployment</CardTitle>
                <CardDescription>
                  Your project was deployed 3 minutes ago.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Build completed in 42s with 0 errors and 2 warnings.
                </p>
              </CardContent>
              <CardFooter className="gap-2">
                <Button size="sm">View</Button>
                <Button size="sm" variant="ghost">
                  Dismiss
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Form Field */}
          <div>
            <VignetteLabel>Form</VignetteLabel>
            <div className="space-y-4 rounded-lg border border-border/80 bg-card p-5">
              <div className="space-y-1.5">
                <Label htmlFor="demo-email">Email address</Label>
                <Input
                  id="demo-email"
                  placeholder="you@example.com"
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  We&apos;ll never share your email.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-name">Full name</Label>
                <Input
                  id="demo-name"
                  placeholder="Required"
                  variant="error"
                  readOnly
                />
                <p className="text-xs text-destructive">
                  This field is required.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div>
            <VignetteLabel>Actions</VignetteLabel>
            <div className="rounded-lg border border-border/80 bg-card p-5">
              <div className="flex flex-wrap gap-2">
                <Button size="sm">Primary</Button>
                <Button size="sm" variant="secondary">
                  Secondary
                </Button>
                <Button size="sm" variant="outline">
                  Outline
                </Button>
                <Button size="sm" variant="ghost">
                  Ghost
                </Button>
                <Button size="sm" variant="destructive">
                  Delete
                </Button>
              </div>
            </div>
          </div>

          {/* Status Badges */}
          <div>
            <VignetteLabel>Status</VignetteLabel>
            <div className="rounded-lg border border-border/80 bg-card p-5">
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Draft</Badge>
                <Badge variant="accent">In Review</Badge>
                <Badge variant="outline">Archived</Badge>
                <Badge variant="destructive">Failed</Badge>
              </div>
            </div>
          </div>

          {/* Feedback Alerts */}
          <div className="lg:col-span-2">
            <VignetteLabel>Feedback</VignetteLabel>
            <div className="space-y-3">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Trial ending soon</AlertTitle>
                <AlertDescription>
                  Your trial ends in 3 days. Upgrade to keep all features.
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Payment declined</AlertTitle>
                <AlertDescription>
                  Your payment method was declined. Please update your billing
                  information.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      </DemoSection>

      {/* ── Section 5: Color Adjacency ─────────────────────────── */}
      <DemoSection
        title="Color Adjacency"
        description="How tokens look when placed side by side. Adjacent colors should maintain sufficient contrast to remain distinguishable."
      >
        <div className="space-y-8">
          {/* Semantic strip */}
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">
              Semantic colors touching
            </p>
            <div className="flex overflow-hidden rounded-lg">
              {adjacencyPairs.map(({ bg, fg, label }) => (
                <div
                  key={bg}
                  className="flex-1 px-3 py-2 text-center text-xs font-medium"
                  style={{
                    backgroundColor: `var(--${bg})`,
                    color: `var(--${fg})`,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Border visibility on surfaces */}
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">
              Border visibility on every surface
            </p>
            <div className="flex flex-wrap">
              {surfaceTokens.map(({ bg, label }) => (
                <div
                  key={bg}
                  className="border px-4 py-3 text-xs font-medium"
                  style={{
                    backgroundColor: `var(--${bg})`,
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Text across surfaces */}
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">
              Text colors across surfaces
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="pb-2 pr-3 text-left font-mono text-muted-foreground font-normal">
                      surface \
                    </th>
                    {textOnSurfaces.map(({ label }) => (
                      <th
                        key={label}
                        className="pb-2 px-3 text-left font-mono text-muted-foreground font-normal"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {surfaceTokens.slice(0, 4).map(({ bg, label }) => (
                    <tr key={bg}>
                      <td className="py-1 pr-3 font-mono text-muted-foreground">
                        {label}
                      </td>
                      {textOnSurfaces.map(({ fg }) => (
                        <td key={fg} className="px-3 py-1">
                          <span
                            className="inline-block rounded px-2 py-1 text-sm font-medium"
                            style={{
                              backgroundColor: `var(--${bg})`,
                              color: `var(--${fg})`,
                            }}
                          >
                            Sample
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DemoSection>

      {/* ── Section 6: Chart Colors ────────────────────────────── */}
      <DemoSection
        title="Chart Colors"
        description="A five-step teal gradient optimized for data visualizations. All five colors remain distinguishable in both themes."
      >
        <div className="space-y-6">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
            {/* Stacked bar */}
            <div className="flex-1">
              <p className="mb-2 text-xs font-medium text-foreground">
                Stacked bar
              </p>
              <div className="flex h-10 overflow-hidden rounded-lg">
                {chartSegments.map(({ token, width }) => (
                  <div
                    key={token}
                    style={{
                      backgroundColor: `var(--${token})`,
                      width: `${width}%`,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Donut */}
            <div className="flex flex-col items-center">
              <p className="mb-2 text-xs font-medium text-foreground">
                Donut
              </p>
              <div
                className="h-28 w-28 rounded-full"
                style={{
                  background: `conic-gradient(
                    var(--chart-1) 0% 20%,
                    var(--chart-2) 20% 40%,
                    var(--chart-3) 40% 60%,
                    var(--chart-4) 60% 80%,
                    var(--chart-5) 80% 100%
                  )`,
                  mask: "radial-gradient(circle at center, transparent 55%, black 56%)",
                  WebkitMask:
                    "radial-gradient(circle at center, transparent 55%, black 56%)",
                }}
              />
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4">
            {chartColors.map((token) => (
              <div key={token.name} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: `var(--${token.name})` }}
                />
                <span className="text-xs font-mono text-muted-foreground">
                  --{token.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </DemoSection>
    </>
  );
}
