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

// ── Token data ──────────────────────────────────────────────────────

interface GlowToken {
  name: string;
  label: string;
  description: string;
  usage: string;
}

const glowTokens: GlowToken[] = [
  {
    name: "glow-warm",
    label: "Warm",
    description: "Soft peach glow — inviting, approachable",
    usage: "Landing page hero",
  },
  {
    name: "glow-warm-intense",
    label: "Warm Intense",
    description: "Stronger orange glow — energetic, focused",
    usage: "Sign-in page",
  },
  {
    name: "glow-cool",
    label: "Cool",
    description: "Subtle blue glow — calm, professional",
    usage: "Sign-up page",
  },
  {
    name: "glow-brand",
    label: "Brand",
    description: "Teal glow — brand-aligned accent",
    usage: "Brand-accent surfaces",
  },
];

const opacitySteps = [0.2, 0.4, 0.6, 0.8, 1];

// ── Main showcase ───────────────────────────────────────────────────

export default function GlowsShowcase() {
  return (
    <>
      {/* ── Section 1: Token Reference ─────────────────────────── */}
      <DemoSection
        title="Glow Tokens"
        description="Four radial glow effects that adapt to light and dark themes. Each uses complementary or brand-aligned colors that composite over the background surface."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {glowTokens.map((token) => (
            <div key={token.name} className="space-y-2">
              <div
                className="h-40 rounded-lg border border-border/40"
                style={{ background: `var(--${token.name})` }}
              />
              <div className="space-y-0.5 px-1">
                <p className="text-xs font-semibold text-foreground">
                  {token.label}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  --{token.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {token.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </DemoSection>

      {/* ── Section 2: Intensity Scale ─────────────────────────── */}
      <DemoSection
        title="Intensity Scale"
        description="Control glow strength with CSS opacity on the container. Lower values create subtle hints; 1 is the default full-strength glow."
      >
        <div className="space-y-6">
          {glowTokens.map((token) => (
            <div key={token.name}>
              <p className="mb-2 text-xs font-medium text-foreground">
                --{token.name}
              </p>
              <div className="grid grid-cols-5 gap-3">
                {opacitySteps.map((opacity) => (
                  <div key={opacity} className="space-y-1">
                    <div
                      className="relative h-48 rounded-lg border border-border/30"
                      style={{
                        background: `var(--${token.name})`,
                        opacity,
                      }}
                    />
                    <p
                      className={`text-center text-[10px] font-mono ${opacity === 1 ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                    >
                      {opacity === 1 ? "1 (default)" : opacity}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DemoSection>

      {/* ── Section 3: Page Backgrounds ────────────────────────── */}
      <DemoSection
        title="Page Backgrounds"
        description="How the glow tokens are used as full-page backgrounds. These mini mockups mirror the landing, sign-in, and sign-up pages."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Landing */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">
              Landing — --glow-warm
            </p>
            <div
              className="flex h-56 flex-col items-center justify-center rounded-lg border border-border/40 px-4"
              style={{ background: "var(--glow-warm)" }}
            >
              <Badge variant="secondary" className="mb-3 text-[9px]">
                STARTER KIT
              </Badge>
              <p className="text-sm font-semibold text-foreground">
                Your starting line.
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Build from here.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm">Get started</Button>
                <Button size="sm" variant="outline">
                  Sign in
                </Button>
              </div>
            </div>
          </div>

          {/* Sign in */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">
              Sign in — --glow-warm-intense
            </p>
            <div
              className="flex h-56 items-center justify-center rounded-lg border border-border/40 px-6"
              style={{ background: "var(--glow-warm-intense)" }}
            >
              <div className="w-full max-w-[180px] rounded-md border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur-sm">
                <p className="text-[10px] font-semibold text-foreground">
                  Welcome back
                </p>
                <div className="mt-2 space-y-1.5">
                  <div className="h-5 rounded border border-border/40 bg-background/50" />
                  <div className="h-5 rounded border border-border/40 bg-background/50" />
                  <div className="mt-1 h-5 rounded bg-primary" />
                </div>
              </div>
            </div>
          </div>

          {/* Sign up */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">
              Sign up — --glow-cool
            </p>
            <div
              className="flex h-56 items-center justify-center rounded-lg border border-border/40 px-6"
              style={{ background: "var(--glow-cool)" }}
            >
              <div className="w-full max-w-[180px] rounded-md border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur-sm">
                <p className="text-[10px] font-semibold text-foreground">
                  Create account
                </p>
                <div className="mt-2 space-y-1.5">
                  <div className="h-5 rounded border border-border/40 bg-background/50" />
                  <div className="h-5 rounded border border-border/40 bg-background/50" />
                  <div className="h-5 rounded border border-border/40 bg-background/50" />
                  <div className="mt-1 h-5 rounded bg-primary" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </DemoSection>

      {/* ── Section 4: Card Backgrounds ────────────────────────── */}
      <DemoSection
        title="Card Backgrounds"
        description="Glows add subtle warmth or cool accents to card surfaces. Great for feature highlights, promotions, and stats."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Feature highlight */}
          <Card
            className="overflow-hidden border-border/40"
            style={{ background: "var(--glow-brand)" }}
          >
            <CardHeader>
              <Badge className="w-fit" variant="secondary">
                New
              </Badge>
              <CardTitle className="text-base">Real-time sync</CardTitle>
              <CardDescription>
                Data updates propagate instantly across all connected clients.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button size="sm">Learn more</Button>
            </CardFooter>
          </Card>

          {/* Promotional */}
          <Card
            className="overflow-hidden border-border/40"
            style={{ background: "var(--glow-warm)" }}
          >
            <CardHeader>
              <Badge className="w-fit" variant="accent">
                Limited
              </Badge>
              <CardTitle className="text-base">Early access</CardTitle>
              <CardDescription>
                Join the waitlist and be the first to try new features.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <div className="flex gap-2">
                <Button size="sm">Join waitlist</Button>
                <Button size="sm" variant="ghost">
                  Maybe later
                </Button>
              </div>
            </CardFooter>
          </Card>

          {/* Stats */}
          <Card
            className="overflow-hidden border-border/40"
            style={{ background: "var(--glow-cool)" }}
          >
            <CardHeader>
              <CardTitle className="text-base">Weekly report</CardTitle>
              <CardDescription>
                Your project metrics at a glance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-2xl font-bold text-foreground">1,284</p>
                  <p className="text-[11px] text-muted-foreground">
                    API calls
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">99.8%</p>
                  <p className="text-[11px] text-muted-foreground">Uptime</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DemoSection>

      {/* ── Section 5: Other Use Cases ─────────────────────────── */}
      <DemoSection
        title="Other Use Cases"
        description="Glows can be applied to any surface — hero banners, sidebars, form sections, or tag clouds."
      >
        <div className="space-y-6">
          {/* Hero banner */}
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">
              Hero banner — --glow-brand
            </p>
            <div
              className="flex flex-col items-center justify-center rounded-lg border border-border/40 px-6 py-12"
              style={{ background: "var(--glow-brand)" }}
            >
              <h3 className="text-xl font-semibold text-foreground">
                Ship faster with confidence
              </h3>
              <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
                Everything you need to build, test, and deploy production-ready
                applications.
              </p>
              <div className="mt-4 flex gap-3">
                <Button>Start building</Button>
                <Button variant="outline">View docs</Button>
              </div>
            </div>
          </div>

          {/* Split layout: sidebar + content */}
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">
              Sidebar accent — --glow-warm
            </p>
            <div className="flex overflow-hidden rounded-lg border border-border/40">
              <div
                className="w-48 shrink-0 border-r border-border/40 p-4"
                style={{ background: "var(--glow-warm)" }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Navigation
                </p>
                <div className="mt-3 space-y-1">
                  {["Dashboard", "Projects", "Settings", "Team"].map(
                    (item) => (
                      <p
                        key={item}
                        className={`rounded px-2 py-1 text-xs ${item === "Dashboard" ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground"}`}
                      >
                        {item}
                      </p>
                    ),
                  )}
                </div>
              </div>
              <div className="flex-1 p-4">
                <p className="text-sm font-semibold text-foreground">
                  Dashboard
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Main content area without glow.
                </p>
              </div>
            </div>
          </div>

          {/* Form section */}
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">
              Form section — --glow-cool
            </p>
            <div
              className="rounded-lg border border-border/40 p-6"
              style={{ background: "var(--glow-cool)" }}
            >
              <h4 className="text-sm font-semibold text-foreground">
                Contact us
              </h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                We&apos;ll get back to you within 24 hours.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="glow-name">Name</Label>
                  <Input
                    id="glow-name"
                    placeholder="Your name"
                    readOnly
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="glow-email">Email</Label>
                  <Input
                    id="glow-email"
                    placeholder="you@example.com"
                    readOnly
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button size="sm">Send message</Button>
              </div>
            </div>
          </div>

          {/* Badge/chip highlight */}
          <div>
            <p className="mb-2 text-xs font-medium text-foreground">
              Tag cloud — --glow-warm
            </p>
            <div
              className="rounded-lg border border-border/40 p-4"
              style={{ background: "var(--glow-warm)" }}
            >
              <div className="flex flex-wrap gap-1.5">
                {[
                  "React",
                  "TypeScript",
                  "Tailwind",
                  "Convex",
                  "Next.js",
                  "Radix UI",
                  "Better Auth",
                  "OKLCH",
                ].map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DemoSection>
    </>
  );
}
