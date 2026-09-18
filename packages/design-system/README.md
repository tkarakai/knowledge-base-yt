# @repo/design-system

Shared UI components, design tokens, and utilities for all apps in the monorepo.

## Exports

| Export path | What it provides |
|---|---|
| `@repo/design-system` | React components (Button, Card, Input, etc.), `cn()` utility, hooks |
| `@repo/design-system/styles/globals.css` | Design tokens (CSS custom properties) and global styles |
| `@repo/design-system/tailwind.config` | Shared Tailwind CSS v4 configuration |

## Quick start

```tsx
// Import components
import { Button, Card, Badge, cn } from "@repo/design-system";

// Import global styles (in your root layout)
import "@repo/design-system/styles/globals.css";
```

## Design tokens

All tokens are defined as CSS custom properties in `tokens/index.css` with automatic light/dark mode variants.

### Colors

The theme uses **Stone + Teal (Mira)** in OKLCH color space. Key token groups:

- `--background`, `--foreground` — page surface and text
- `--primary`, `--primary-foreground` — brand teal for CTAs
- `--muted`, `--muted-foreground` — subdued surfaces and secondary text
- `--accent`, `--accent-foreground` — hover/focus highlights
- `--card`, `--card-foreground` — card surfaces
- `--border`, `--input`, `--ring` — borders and focus rings
- `--sidebar-*` — sidebar-specific variants

### Glows

Radial glow effects for page and card backgrounds. Each token contains a full `radial-gradient(circle at top, ...)` value with RGBA colors that composite over the theme's `--background`, giving automatic light/dark adaptation.

#### Available tokens

| Token | Light mode | Dark mode | Used on |
|---|---|---|---|
| `--glow-warm` | Soft peach (0.55 opacity) | Subtle peach (0.15 opacity) | Landing page |
| `--glow-warm-intense` | Stronger orange (0.65 opacity) | Moderate orange (0.2 opacity) | Sign-in page |
| `--glow-cool` | Blue-tinted (0.65 opacity) | Subtle blue (0.2 opacity) | Sign-up page |
| `--glow-brand` | Teal-aligned (0.5 opacity) | Subtle teal (0.15 opacity) | Brand accent surfaces |

#### Usage

Apply via inline `style` — Tailwind's `bg-[...]` doesn't work for full gradient values stored in CSS variables.

```tsx
// Page background
<main
  className="min-h-screen"
  style={{ background: "var(--glow-warm)" }}
>

// Card background
<Card style={{ background: "var(--glow-brand)" }}>

// Any surface
<section style={{ background: "var(--glow-cool)" }}>
```

#### Controlling intensity

The tokens define fixed-opacity gradients. To reduce or increase intensity, use CSS `opacity` on the container:

```tsx
// Subtle glow (40% intensity)
<div
  style={{ background: "var(--glow-warm)", opacity: 0.4 }}
>

// Full-strength glow (default)
<div style={{ background: "var(--glow-warm)" }}>
```

> **Note**: `opacity` affects the entire element including its children. If you need children at full opacity, wrap the glow in an absolute-positioned layer behind the content.

#### Storybook

See the **Glows** page under **Foundations > Visual** in the storybook app for live previews of all tokens, intensity scales, page backgrounds, card backgrounds, and other use cases.

## Components

All components are built on [Radix UI](https://www.radix-ui.com) primitives for accessibility. They are organized by category:

| Category | Components |
|---|---|
| **Actions** | Button, Toggle |
| **Data Display** | Avatar, Badge, Breadcrumb, Progress, Separator, Skeleton, Table |
| **Feedback** | Alert, AlertDialog |
| **Form** | Checkbox, Input, Label, RadioGroup, Select, Switch, Textarea |
| **Layout** | Card, Collapsible, Sidebar, Tabs |
| **Overlay** | Dialog, DropdownMenu, Popover, Sheet, Tooltip |

### Utilities

- **`cn(...classes)`** — Combines class names with `clsx` + `tailwind-merge` for conflict-free Tailwind class merging.
- **`useIsMobile()`** — Hook that returns `true` when the viewport is below the mobile breakpoint.
