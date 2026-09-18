# i18n Architecture

This document describes the internationalization (i18n) system architecture. It covers the library choice, routing strategy, translation file structure, component usage patterns, formatting, ICU messages, backend error codes, language selector, locale detection, RTL support, cross-device persistence, and SEO optimization.

## Overview

The system uses **[next-intl](https://next-intl.dev) v4+** as the core i18n library, purpose-built for Next.js App Router and Server Components. All user-facing strings are extracted into a shared `@repo/i18n` package. The system currently supports **15 languages** across LTR and RTL scripts, with full support for cross-device locale persistence, SEO optimization, multi-script fonts, and RTL layout mirroring. Adding a new language requires only two steps — no code changes.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Library | next-intl v4+ | First-class Next.js App Router / RSC support, ICU MessageFormat, built-in formatting, tree-shaking |
| URL strategy | Always prefix (`/en/...`, `/fr/...`) | Consistent, shareable URLs; SSR can determine locale from URL; SEO-friendly |
| Shared strings | `@repo/i18n` package | Single source of truth for all apps; messages co-located with config |
| Shared components | Labels via props (inversion of control) | Packages stay locale-agnostic; no React context dependency |
| Backend errors | Error codes (UPPER_SNAKE_CASE) | Backend stays locale-agnostic; client maps codes to translations |
| RTL | Pre-configured, layout-level `dir` attribute | Ready for RTL locales; no code changes needed to enable |

---

## Package Structure

```
packages/i18n/                     # @repo/i18n
├── src/
│   ├── index.ts                   # Re-exports config types and utilities
│   ├── config.ts                  # Locale list, metadata, RTL detection
│   ├── request.ts                 # next-intl getRequestConfig() for server
│   └── navigation.ts             # Typed Link, redirect, usePathname, useRouter
├── messages/
│   └── en.json                    # English translations (source of truth)
├── package.json
└── tsconfig.json
```

### Package Exports

| Export Path | Contents |
|-------------|----------|
| `@repo/i18n` | `locales`, `defaultLocale`, `localeMetadata`, `getLocaleDirection`, `Locale` type |
| `@repo/i18n/request` | Server-side request configuration for next-intl |
| `@repo/i18n/navigation` | `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` |
| `@repo/i18n/messages/*` | Direct access to JSON message files |

---

## Locale Configuration

### `packages/i18n/src/config.ts`

```ts
export const locales = ["en"] as const;
export const defaultLocale = "en" as const;
export type Locale = (typeof locales)[number];

export const localeMetadata: Record<Locale, { name: string; nativeName: string; dir: "ltr" | "rtl" }> = {
  en: { name: "English", nativeName: "English", dir: "ltr" },
};

const rtlLocales = new Set(["ar", "he", "fa", "ur"]);

export function getLocaleDirection(locale: string): "ltr" | "rtl" {
  return rtlLocales.has(locale) ? "rtl" : "ltr";
}
```

The `locales` array is the single source of truth. All routing, middleware, and static generation derive from it.

---

## Routing

### URL Pattern

All routes include a locale prefix. There is no unprefixed default.

| App | Example URLs |
|-----|-------------|
| Landing | `/en`, `/fr`, `/ar` |
| Web (auth) | `/en/sign-in`, `/en/sign-up` |
| Web (dashboard) | `/en/dashboard` |

### Navigation Primitives

`packages/i18n/src/navigation.ts` creates locale-aware replacements for Next.js navigation:

```ts
import { createNavigation } from "next-intl/navigation";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation({ locales, defaultLocale, localePrefix: "always" });
```

Use these instead of `next/link` and `next/navigation` to ensure locale is always preserved in URLs.

### File System Layout

Both apps nest all pages under a `[locale]` dynamic segment:

```
apps/web/src/app/
├── [locale]/
│   ├── layout.tsx              # Root layout with NextIntlClientProvider
│   ├── page.tsx                # Redirect to /[locale]/dashboard
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── sign-in/page.tsx
│   │   └── sign-up/page.tsx
│   └── (dashboard)/
│       ├── layout.tsx
│       └── dashboard/
│           ├── page.tsx
│           └── dashboard-client.tsx
└── api/                        # API routes (no locale segment)

apps/landing/src/app/
├── [locale]/
│   ├── layout.tsx
│   └── page.tsx
```

---

## Middleware Composition

next-intl's middleware is composed with the existing auth proxy and CSP header middleware. The composition order differs between apps.

### Web App (`apps/web/src/proxy.ts`)

```
Request
  → Strip locale prefix, detect locale from path
  → Auth checks (cookie-based):
      - Unauthenticated + protected route → redirect to /{locale}/sign-in
      - Authenticated + auth page → redirect to /{locale}/dashboard
  → next-intl middleware (locale detection, URL rewriting, cookie)
  → CSP headers (nonce-based)
  → Response
```

Auth redirects preserve the active locale by extracting it from the URL path before redirecting.

### Landing App (`apps/landing/src/proxy.ts`)

```
Request
  → next-intl middleware (locale detection, URL rewriting, cookie)
  → CSP headers
  → Response
```

No auth checks needed — the landing page is public.

### next-intl Middleware Configuration

Both apps use the same configuration:

```ts
import createIntlMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "@repo/i18n";

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});
```

---

## Provider Setup

### Root Layout Pattern

Each app's `[locale]/layout.tsx` follows the same pattern:

```tsx
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { getLocaleDirection } from "@repo/i18n";

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  const messages = await getMessages();
  const dir = getLocaleDirection(locale);

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

Key aspects:
- `generateStaticParams()` pre-renders all locale routes
- `lang` and `dir` attributes are set dynamically on `<html>`
- `NextIntlClientProvider` makes translations available to all client components
- Messages are loaded server-side via `getMessages()` and passed to the provider

### Request Configuration

Each app has a thin `src/i18n/request.ts` file that re-exports the shared config:

```ts
export { default } from "@repo/i18n/request";
```

This is referenced by the next-intl plugin in `next.config.ts`:

```ts
import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
export default withNextIntl(nextConfig);
```

---

## Translation Usage

### Server Components

Use `getTranslations()` from `next-intl/server` (async):

```tsx
import { getTranslations } from "next-intl/server";

export default async function SignInPage() {
  const t = await getTranslations("auth.signIn");
  const tc = await getTranslations("common");

  return (
    <div>
      <h1>{t("pageHeading")}</h1>
      <p>{tc("appName")}</p>
    </div>
  );
}
```

### Client Components

Use `useTranslations()` hook from `next-intl`:

```tsx
"use client";
import { useTranslations } from "next-intl";

export function TaskList() {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");

  return (
    <div>
      <h2>{t("title")}</h2>
      <p>{t("progress", { doneCount: 3, totalCount: 5 })}</p>
      <button>{tc("save")}</button>
    </div>
  );
}
```

### Shared Package Components (Inversion of Control)

Components in `@repo/design-patterns` cannot access `NextIntlClientProvider` context. They accept translated strings as props with English fallback defaults:

```tsx
// packages/design-patterns/src/theme-toggle.tsx
const defaultLabels = {
  light: "Light theme",
  system: "System theme",
  dark: "Dark theme",
  aria: "Theme: {label}. Click to switch.",
};

interface ThemeToggleProps {
  labels?: { light: string; system: string; dark: string; aria: string };
}

export function ThemeToggle({ labels }: ThemeToggleProps) {
  const l = labels ?? defaultLabels;
  // ...
}
```

Consumer provides translations:

```tsx
const tt = useTranslations("theme");

<ThemeToggle labels={{
  light: tt("light"),
  system: tt("system"),
  dark: tt("dark"),
  aria: tt("ariaLabel"),
}} />
```

This pattern keeps shared packages locale-agnostic while allowing full translation.

---

## Translation File Structure

All translations live in `packages/i18n/messages/en.json`. The file is organized by domain namespace:

```json
{
  "common":    { "appName", "loading", "cancel", "save", "saving", "create", "creating", "delete", "signOut", "error" },
  "theme":     { "light", "system", "dark", "ariaLabel" },
  "language":  { "label", "ariaLabel" },
  "auth":      { "signIn": {...}, "signUp": {...}, "fields": {...}, "errors": {...}, "badge", "footer", "working" },
  "landing":   { "badge", "heading", "description", "getStarted", "signIn" },
  "dashboard": { "projects", "tabs": {...}, "noProjects", "noProjectsDescription", ... },
  "projects":  { "newProject", "editProject", "deleteConfirmTitle", "deleteConfirmDescription", "fields": {...} },
  "tasks":     { "title", "addTask", "status": {...}, "fields": {...}, "aria": {...}, "progress", "count" },
  "uploads":   { "title", "addFile", "uploading", "errors": {...}, "count" },
  "errors":    { "NOT_AUTHENTICATED", "PROJECT_NOT_FOUND", "TASK_NOT_FOUND", ... },
  "metadata":  { "title", "description" }
}
```

### Naming Conventions

| Pattern | Example | When to use |
|---------|---------|-------------|
| Flat key | `"title": "Tasks"` | Simple labels |
| Nested namespace | `"auth.signIn.title"` | Domain-grouped strings |
| With interpolation | `"deleteConfirmDescription": "...delete \"{name}\"..."` | Dynamic values |
| ICU plural | `"{count, plural, =0 {No tasks} one {# task} other {# tasks}}"` | Countable items |

---

## ICU Message Format

next-intl uses ICU MessageFormat syntax natively for plurals, variables, and select expressions.

### Variable Interpolation

```json
{ "progress": "{doneCount} of {totalCount} tasks done" }
```

```tsx
t("progress", { doneCount: 3, totalCount: 5 }); // "3 of 5 tasks done"
```

### Plurals

```json
{ "count": "{count, plural, =0 {No tasks yet} one {# task} other {# tasks}}" }
```

```tsx
t("count", { count: 0 }); // "No tasks yet"
t("count", { count: 1 }); // "1 task"
t("count", { count: 5 }); // "5 tasks"
```

### Select (for enums/gender)

```json
{ "greeting": "{gender, select, male {He} female {She} other {They}} updated the project." }
```

---

## Backend Error Handling

### Error Code Pattern

Backend (Convex) functions throw error codes as plain UPPER_SNAKE_CASE strings, keeping the backend completely locale-agnostic:

```ts
// packages/backend/convex/functions.ts
throw new Error("NOT_AUTHENTICATED");
throw new Error("PROJECT_NOT_FOUND");

// packages/backend/convex/tasks.ts
throw new Error("TASK_NOT_FOUND");

// packages/backend/convex/files.ts
throw new Error("FILE_NOT_FOUND");
throw new Error("FILE_TOO_LARGE");
throw new Error("UPLOAD_NOT_FOUND");
```

### Client-Side Error Mapping

`apps/web/src/lib/error-messages.ts` maps error codes to translation keys:

```ts
const ERROR_CODE_MAP: Record<string, string> = {
  NOT_AUTHENTICATED: "errors.NOT_AUTHENTICATED",
  PROJECT_NOT_FOUND: "errors.PROJECT_NOT_FOUND",
  TASK_NOT_FOUND:    "errors.TASK_NOT_FOUND",
  FILE_NOT_FOUND:    "errors.FILE_NOT_FOUND",
  FILE_TOO_LARGE:    "errors.FILE_TOO_LARGE",
  UPLOAD_NOT_FOUND:  "errors.UPLOAD_NOT_FOUND",
};

export function getErrorMessageKey(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return ERROR_CODE_MAP[message] ?? "common.error";
}
```

Usage in components:

```tsx
const t = useTranslations();

try {
  await mutation(args);
} catch (error) {
  const key = getErrorMessageKey(error);
  toast.error(t(key)); // Translated error message
}
```

---

## Language Selector

### Component Design

`LanguageSelector` lives in `@repo/design-patterns` as a pure presentation component with no i18n dependency:

```tsx
interface LanguageSelectorProps {
  currentLocale: string;
  locales: { code: string; nativeName: string }[];
  onSelect: (locale: string) => void;
  ariaLabel?: string;
  className?: string;
}
```

- Renders a native `<select>` with a Globe icon
- Displays each language in its native name
- Returns `null` when only one locale is available (hides itself)
- Consumer handles navigation on select

### Placement

| Location | Component | Integration |
|----------|-----------|-------------|
| Landing page | `SiteHeader` | Header bar with logo + language selector |
| Auth pages (sign-in, sign-up) | `LocaleSwitcher` | Positioned in the page header |
| Dashboard sidebar | `LocaleSwitcher` | Inside user profile dropdown menu, above ThemeToggle |

### LocaleSwitcher Wrapper

`apps/web/src/components/ui/locale-switcher.tsx` wraps `LanguageSelector` with navigation logic:

```tsx
"use client";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { LanguageSelector } from "@repo/design-patterns";
import { locales, localeMetadata, type Locale } from "@repo/i18n";

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const handleLocaleChange = (newLocale: string) => {
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/") || `/${newLocale}`);
  };

  return (
    <LanguageSelector
      currentLocale={locale}
      locales={locales.map((code) => ({
        code,
        nativeName: localeMetadata[code as Locale].nativeName,
      }))}
      onSelect={handleLocaleChange}
    />
  );
}
```

The navigation works by replacing the locale segment (first path segment) in the current URL.

---

## Locale Detection & Persistence

### Detection Priority (via next-intl middleware)

1. **URL path** — `/fr/dashboard` → French
2. **User profile** (authenticated only, Convex) — cross-device persistence
3. **Cookie** (`NEXT_LOCALE`) — persists explicit language choice
4. **Accept-Language header** — browser preference
5. **Default locale** — English

### Persistence Strategy

The system uses a **three-tier sync** approach for authenticated users:

#### For Unauthenticated Users

When a user selects a language:
1. The `LocaleSwitcher` navigates to the new locale URL
2. next-intl middleware automatically sets the `NEXT_LOCALE` cookie
3. Subsequent visits remember the choice via localStorage fallback

#### For Authenticated Users (Cross-Device Sync)

The `useProfileSync` hook orchestrates Convex ↔ localStorage synchronization:

```tsx
export function useProfileSync() {
  const currentLocale = useLocale();
  const profile = useQuery(api.userProfiles.get);
  const setLocale = useMutation(api.userProfiles.setLocale);

  useEffect(() => {
    // Convex wins over localStorage
    if (convexLocale) {
      localStorage.setItem(LOCALE_KEY, convexLocale);
      return;
    }

    // Sync localStorage to Convex if Convex is empty
    if (localStorageLocale && localStorageLocale !== currentLocale) {
      setLocale({ locale: localStorageLocale });
      return;
    }

    // Neither has locale: set Convex to current URL locale
    if (!convexLocale && !localStorageLocale) {
      setLocale({ locale: currentLocale });
    }
  }, [profile, currentLocale, setLocale]);
}
```

**How it works:**

1. User logs in → profile is created with `locale` field in Convex
2. User changes language → `LocaleSwitcher` saves to both localStorage and Convex (`setLocale` mutation)
3. User signs out and back in → profile is loaded, Convex locale overwrites localStorage
4. User on another device → logs in, Convex locale is loaded and synced to localStorage
5. User opens app in another tab → BroadcastChannel shares the locale change instantly

**Backend schema** (`packages/backend/convex/userProfiles.ts`):

```ts
userProfiles: defineTable({
  ownerId: v.string(),
  locale: v.optional(v.string()),      // Synced from localStorage
  theme: v.optional(v.string()),       // Reserved for future theme sync
  timezone: v.optional(v.string()),    // Reserved for future timezone sync
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_owner", ["ownerId"]),
```

**Hook placement:** Called from `DashboardClient` (authenticated dashboard area) to ensure both Convex and i18n contexts are available.

---

## RTL Support

RTL layout is fully supported with the following implementation:

1. **Detects RTL locales** via `getLocaleDirection()` — pre-configured for Arabic, Hebrew, Farsi, Urdu
2. **Sets `dir` attribute** on `<html>` dynamically in each app's root layout
3. **CSS logical properties** replace physical directional classes throughout:
   - `left-*` / `right-*` → `start-*` / `end-*`
   - `ml-*` / `mr-*` → `ms-*` / `me-*`
   - `pl-*` / `pr-*` → `ps-*` / `pe-*`
   - `text-left` / `text-right` → `text-start` / `text-end`
4. **Tailwind CSS v4** handles automatic mirroring based on `dir` attribute

### Font Strategy

Conditional font loading for multi-script support:

- **Arabic** (`ar`) — [Cairo](https://fonts.google.com/specimen/Cairo) font with Arabic script
- **Hebrew** (`he`) — [Heebo](https://fonts.google.com/specimen/Heebo) font with Hebrew script
- **Other locales** — [Raleway](https://fonts.google.com/specimen/Raleway) (default, optimized for Latin)

Font selection is configured per-locale in the root layout:

```tsx
const fontsByLocale: Record<string, ReturnType<typeof Cairo>> = {
  ar: cairo,
  he: heebo,
};

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  const font = fontsByLocale[locale] || raleway;

  return <html className={font.variable}>{/* ... */}</html>;
}
```

All fonts use `display: swap` to prevent FOIT (Flash of Invisible Text).

---

## Supported Locales

The application currently supports **15 languages** across LTR and RTL scripts:

| Code | Language | Native Name | Direction | Font |
|------|----------|-------------|-----------|------|
| `en` | English | English | LTR | Raleway |
| `ar` | Arabic | العربية | RTL | Cairo |
| `cs` | Czech | Čeština | LTR | Raleway |
| `de` | German | Deutsch | LTR | Raleway |
| `es` | Spanish | Español | LTR | Raleway |
| `fr` | French | Français | LTR | Raleway |
| `he` | Hebrew | עברית | RTL | Heebo |
| `hu` | Hungarian | Magyar | LTR | Raleway |
| `it` | Italian | Italiano | LTR | Raleway |
| `ja` | Japanese | 日本語 | LTR | Raleway |
| `nl` | Dutch | Nederlands | LTR | Raleway |
| `pl` | Polish | Polski | LTR | Raleway |
| `pt` | Portuguese | Português | LTR | Raleway |
| `ru` | Russian | Русский | LTR | Raleway |
| `zh` | Chinese (Simplified) | 简体中文 | LTR | Raleway |

All locales are configured in `packages/i18n/src/config.ts` with metadata and direction detection.

---

## Adding a New Language

To add a new language (e.g., French):

### Step 1: Create the translation file

Copy `packages/i18n/messages/en.json` to `packages/i18n/messages/fr.json` and translate all values.

### Step 2: Register the locale

In `packages/i18n/src/config.ts`:

```diff
-export const locales = ["en"] as const;
+export const locales = ["en", "fr"] as const;

 export const localeMetadata: Record<Locale, { name: string; nativeName: string; dir: "ltr" | "rtl" }> = {
   en: { name: "English", nativeName: "English", dir: "ltr" },
+  fr: { name: "French", nativeName: "Français", dir: "ltr" },
 };
```

That's it. No other code changes are required. The language selector will automatically show the new language, routing will include `/fr/...` paths, and the middleware will detect and persist the locale.

### For RTL Languages

If the language is RTL (Arabic, Hebrew, etc.), add its entry with `dir: "rtl"`:

```ts
ar: { name: "Arabic", nativeName: "العربية", dir: "rtl" },
```

The `getLocaleDirection()` function and `<html dir>` attribute will handle layout direction automatically. However, a CSS audit of directional classes should be done before shipping RTL support.

---

## Formatting

### Dates, Numbers, and Currency

next-intl provides `useFormatter()` that wraps `Intl` APIs with the current locale:

```tsx
import { useFormatter } from "next-intl";

function MyComponent() {
  const format = useFormatter();

  format.dateTime(new Date(), { dateStyle: "medium", timeStyle: "short" });
  format.number(1234.5);                                    // "1,234.5" (en)
  format.number(29.99, { style: "currency", currency: "USD" });
  format.relativeTime(new Date());                          // "2 hours ago"
}
```

### Existing Utilities

`formatBytes()` in `apps/web/src/lib/format.ts` is kept as-is since byte units are universal across locales. For locale-sensitive number formatting, prefer `useFormatter().number()`.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                     @repo/i18n                            │
│  ┌──────────┐  ┌───────────┐  ┌────────────────┐        │
│  │ config   │  │ request   │  │ navigation     │        │
│  │ locales  │  │ getMessage│  │ Link, redirect │        │
│  │ metadata │  │ Config()  │  │ useRouter      │        │
│  │ getDir() │  │           │  │                │        │
│  └──────────┘  └───────────┘  └────────────────┘        │
│  ┌────────────────────────────────────────────────────┐  │
│  │ messages/en.json, messages/fr.json, ... (15 total) │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌─────────────────────┐  ┌───────────────────┐         │
│  │ hreflang.tsx        │  │ Fonts: Cairo,     │         │
│  │ (generates alt lang │  │ Heebo, Raleway    │         │
│  │ links for SEO)      │  │ (conditional load)│         │
│  └─────────────────────┘  └───────────────────┘         │
└──────────────────────────────────────────────────────────┘
           │                           │
    ┌──────┴──────┐                   │
    ▼             ▼                   ▼
┌────────────┐ ┌────────────┐   ┌─────────────────────┐
│   landing  │ │     web    │   │  @repo/backend      │
│            │ │            │   │  (Convex)           │
│ proxy.ts   │ │ proxy.ts   │   │                     │
│ ├─ intl    │ │ ├─ auth    │   │  userProfiles table:│
│ │ mdw      │ │ │ checks   │   │  ├─ locale (sync)  │
│ └─ CSP     │ │ ├─ intl    │   │  ├─ theme (ready)  │
│            │ │ │ mdw      │   │  └─ timezone       │
│ [locale]/  │ │ └─ CSP     │   │      (ready)        │
│ layout     │ │            │   │                     │
│ ├─ fonts   │ │ [locale]/  │   │ mutations:          │
│ │ (Cairo,  │ │ layout     │   │ ├─ get              │
│ │ Heebo,   │ │ ├─ fonts   │   │ ├─ setLocale        │
│ │ Raleway) │ │ │ (cond.)  │   │ └─ upsert           │
│ ├─ lang,   │ │ ├─ lang    │   │                     │
│ │ dir      │ │ ├─ dir     │   │ Error codes:        │
│ ├─ Meta    │ │ ├─ Meta    │   │ NOT_AUTHENTICATED  │
│ │ data     │ │ │ data     │   │ PROJECT_NOT_FOUND  │
│ ├─ hreflang│ │ ├─ hreflang│   │ TASK_NOT_FOUND     │
│ ├─ Meta    │ │ ├─ Meta    │   │ FILE_NOT_FOUND     │
│ │ Gen      │ │ │ Gen      │   │ FILE_TOO_LARGE     │
│ └─ NICP    │ │ └─ NICP    │   └─────────────────────┘
│            │ │ ├─ Conv    │         │
│ SEO:       │ │ │ Provider │  error-messages.ts
│ ├─ Meta    │ │ └─ Auth    │  maps code → i18n key
│ ├─ href    │ │   Guard    │         │
│ │ lang     │ │            │         ▼
│ ├─ site    │ │ useProfile │  ┌──────────────────┐
│ │ map      │ │ Sync (auth │  │ @repo/design-    │
│ └─ robots  │ │ area)      │  │ patterns         │
│            │ │            │  │                  │
│ (15 locale │ │ Client Cmp │  │ ThemeToggle      │
│  variants) │ │ useTransl()│  │ (labels prop)    │
│            │ │            │  │                  │
│            │ │ Server Cmp │  │ LanguageSelector │
│            │ │ getTrans() │  │ (locale-agnostic)│
│            │ │            │  │                  │
│            │ │ useProfileSync calls:          │
│            │ │ ├─ useQuery(api.userProfiles.get)
│            │ │ ├─ useMutation(setLocale)     │
│            │ │ └─ localStorage ↔ Convex sync │
│            │ │                  │             │
└────────────┘ └────────────────────────────────┘
                                    │
                                    ▼
                          ┌──────────────────────┐
                          │  BroadcastChannel    │
                          │  (instant sync       │
                          │   across tabs)       │
                          └──────────────────────┘
```

---

## SEO & Metadata

### Localized Metadata

Each page supports `generateMetadata()` for localized titles, descriptions, OpenGraph and Twitter cards:

```tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: t("signIn.title"),
    description: t("signIn.description"),
    openGraph: {
      type: "website",
      locale,
      title: t("signIn.title"),
      description: t("signIn.description"),
    },
    twitter: {
      card: "summary_large_image",
      title: t("signIn.title"),
      description: t("signIn.description"),
    },
  };
}
```

### Alternate Language Links (hreflang)

The `HreflangLinks` component in `@repo/i18n` generates SEO-friendly alternate language links for all 15 supported locales plus an `x-default` fallback:

```tsx
<head>
  <HreflangLinks
    locale={locale}
    pathname={pathname}
    siteUrl={process.env.NEXT_PUBLIC_SITE_URL}
  />
</head>
```

Rendered output includes:
```html
<link rel="alternate" hreflang="en" href="https://example.com/en/sign-in" />
<link rel="alternate" hreflang="fr" href="https://example.com/fr/sign-in" />
<link rel="alternate" hreflang="ar" href="https://example.com/ar/sign-in" />
<!-- ... 12 more locales ... -->
<link rel="alternate" hreflang="x-default" href="https://example.com/en/sign-in" />
```

### Sitemaps and Robots.txt

Each app includes locale-aware sitemap generation:

```ts
// apps/web/src/app/sitemap.ts
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/sign-in", "/sign-up", "/dashboard"];
  const entries = locales.flatMap((locale) =>
    routes.map((route) => ({
      url: `${siteUrl}/${locale}${route}`,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, `${siteUrl}/${l}${route}`])
        ),
      },
    }))
  );
  return entries;
}
```

The `robots.txt` references the sitemap:
```
Sitemap: https://example.com/sitemap.xml
```

---

## Testing

### Locale-Aware Tests

All component tests use locale-prefixed URLs following the always-prefix routing strategy:

```tsx
// ✅ Correct
await page.goto("/en/dashboard");
await page.goto("/en/sign-in");

// ❌ Avoid
await page.goto("/dashboard");  // Missing locale prefix
```

### RTL Layout Tests

Comprehensive E2E tests verify RTL layout mirroring for Arabic and Hebrew:

```tsx
test("Arabic page has correct direction and font", async ({ page }) => {
  await page.goto("/ar/sign-in");

  // Verify RTL direction
  const htmlDir = await page.locator("html").getAttribute("dir");
  expect(htmlDir).toBe("rtl");

  // Verify locale
  const htmlLang = await page.locator("html").getAttribute("lang");
  expect(htmlLang).toBe("ar");

  // Verify Cairo font is applied
  const computedFont = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--font-sans")
  );
  expect(computedFont).toBeTruthy();
});
```

### Locale Persistence Tests

E2E tests verify cross-device sync behavior:

```tsx
test("authenticated user syncs locale across sign-out/sign-in", async ({ page }) => {
  // Sign in and change locale
  await page.goto("/en/sign-in");
  // ... perform login ...
  // ... change to French via LocaleSwitcher ...

  // Sign out
  // ... perform logout ...

  // Sign back in
  // ... perform login ...

  // Verify French persists
  await expect(page).toHaveURL(/\/fr\//);
});
```

