# Landing Static

A fully static, serverless variant of the landing page — built with Next.js `output: "export"` and ready to deploy to any CDN or static host without a Node.js server.

## What this is

`landing-static` pre-renders the entire landing site at **build time** into plain HTML, CSS, and JavaScript files. The output is a self-contained `out/` directory that can be uploaded to S3, CloudFront, Netlify, Vercel (static), GitHub Pages, Cloudflare Pages, or any file server.

**What you get:**

- 63 HTML pages (15 locales &times; 4 pages + error pages)
- All JS/CSS/assets bundled and fingerprinted for cache-busting
- Pre-generated `robots.txt` and `sitemap.xml` with all locale alternates
- Full i18n with client-side locale switching (no server round-trip)
- Dark/light/system theme support
- Zero runtime server dependencies

**What's different from the dynamic `landing` app:**

| | `landing` (dynamic) | `landing-static` |
|---|---|---|
| Rendering | Server-side per request | Pre-rendered at build time |
| Hosting | Requires Node.js server | Any static file host / CDN |
| Rate limiting | Edge rate limiter (proxy.ts) | None needed (CDN-level) |
| CSP nonce | Generated per request | Not applicable |
| Fonts | Google Fonts (downloaded at build time) | System font stack (zero external deps) |
| Image optimization | Server-side (`next/image`) | Client-side only (`unoptimized: true`) |
| Trailing slashes | Off | On (CDN compatibility) |

## Quick start

```bash
# From the monorepo root
bun install

# Development (hot reload on port 3004)
bun run dev:landing-static

# Or from this directory
cd apps/landing-static
bun run dev
```

## Building

### Standard build

```bash
cd apps/landing-static
bun run build
```

This produces the `out/` directory with the complete static site. You can preview it locally:

```bash
bun run start
# → http://localhost:3004
```

### Build with production URLs

The two environment variables that matter:

| Variable | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical URL of *this* site (used in sitemap, og:url, hreflang tags) | `http://localhost:3004` |
| `NEXT_PUBLIC_WEB_APP_URL` | URL of the main web app (used in "Get Started" / "Sign In" buttons) | `http://localhost:3001` |

```bash
NEXT_PUBLIC_SITE_URL=https://www.example.com \
NEXT_PUBLIC_WEB_APP_URL=https://app.example.com \
bun run build
```

## Optimizing the build

### What Next.js already does

The static export pipeline applies these optimizations automatically:

- **Tree shaking** — dead code is eliminated by Turbopack
- **Code splitting** — each page loads only the JS it needs
- **CSS extraction** — styles are extracted into a single fingerprinted CSS file
- **Minification** — all JS and CSS are minified in production builds
- **Content hashing** — asset filenames include a hash for infinite cache TTLs

### Current build profile

| Metric | Raw | Gzipped |
|---|---|---|
| Total JS | ~900 KB | ~258 KB |
| Total CSS | 56 KB | ~10 KB |
| Total `out/` directory | 5.6 MB | — |
| HTML pages | 63 files | — |
| JS chunks | 12 files | — |

### Bundle size guardrails

Size limits are enforced via [size-limit](https://github.com/ai/size-limit) in `.size-limit.json`:

```bash
# Check current sizes against limits
bun run size

# Get JSON output for CI
bun run size:check
```

Current limits:
- **JS bundle**: 500 KB gzipped
- **CSS bundle**: 50 KB gzipped

To tighten the limits, edit `.size-limit.json`.

### Further optimization techniques

**1. Compress assets at build time**

Pre-compress with gzip and Brotli so your CDN serves them directly without on-the-fly compression:

```bash
# After building
find out -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" -o -name "*.xml" -o -name "*.txt" -o -name "*.json" \) \
  -exec gzip -9 -k {} \; \
  -exec brotli -Z -k {} \;
```

Most CDNs (CloudFront, Cloudflare, Netlify) will automatically serve `.br` or `.gz` variants when the client supports them.

**2. Add immutable cache headers**

Configure your CDN to serve hashed assets with long-lived caches:

```
# Hashed assets (fingerprinted filenames — safe to cache forever)
/_next/static/*    Cache-Control: public, max-age=31536000, immutable

# HTML pages (may change between deploys)
*.html             Cache-Control: public, max-age=0, must-revalidate

# Metadata (may change between deploys)
/robots.txt        Cache-Control: public, max-age=3600
/sitemap.xml       Cache-Control: public, max-age=3600
```

**3. Reduce locale count**

Each locale adds ~4 HTML pages and its translation bundle to the client JS. If you don't need all 15 locales, edit `packages/i18n/src/config.ts` to remove unused ones — the build output will shrink proportionally.

**4. Analyze the bundle**

```bash
ANALYZE=true bun run build
```

Or use `@next/bundle-analyzer` for a visual treemap:

```bash
# Install (one-time)
bun add -D @next/bundle-analyzer

# Then wrap in next.config.ts:
# import withBundleAnalyzer from "@next/bundle-analyzer";
# export default withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" })(withNextIntl(nextConfig));
```

**5. Subset icon libraries**

The app uses `lucide-react` for icons. Lucide supports tree-shaking, so only imported icons are bundled. If you add icons, prefer specific imports:

```typescript
// Good — tree-shakes to just ArrowLeft
import { ArrowLeft } from "lucide-react";

// Bad — may pull in the full icon set depending on bundler config
import * as Icons from "lucide-react";
```

## Security hardening

Since this is a static site served from a CDN, the security model is different from a server-rendered app. There's no server to compromise, no database to attack, and no user sessions to hijack. The attack surface is limited to the CDN configuration and the client-side code.

### CDN-level headers

Configure these HTTP response headers on your CDN or static host:

```
# Prevent clickjacking
X-Frame-Options: DENY

# Prevent MIME sniffing
X-Content-Type-Options: nosniff

# Control referrer information
Referrer-Policy: strict-origin-when-cross-origin

# Enforce HTTPS
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload

# Restrict browser features
Permissions-Policy: camera=(), microphone=(), geolocation=()

# Content Security Policy (adjust domains to match your deployment)
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

> **Note on CSP:** The dynamic landing app uses nonce-based CSP (`script-src 'nonce-xxx'`). Static sites can't generate per-request nonces, so use `'self'` for script-src instead. Next.js inlines a small theme-detection script, so you may need `'unsafe-inline'` for script-src or use a hash-based CSP — see the [Next.js CSP docs](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy).

### Subresource Integrity (SRI)

Next.js includes `integrity` attributes on `<script>` tags in production builds when using `output: "export"` with `subresourceIntegrity: true`:

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  output: "export",
  experimental: {
    subresourceIntegrity: true,
  },
};
```

This ensures browsers verify that fetched scripts haven't been tampered with.

### Rate limiting

Since there's no server, rate limiting is handled at the CDN/infrastructure level:

- **CloudFront**: Use AWS WAF with rate-based rules
- **Cloudflare**: Built-in rate limiting in dashboard or via Page Rules
- **Netlify**: Use `netlify.toml` rate limit configuration
- **Vercel**: Edge Middleware or Firewall rules (even for static deployments)

## Deployment

### Development

```bash
# Hot-reload dev server (uses Turbopack)
cd apps/landing-static
bun run dev
# → http://localhost:3004

# Or from the monorepo root
bun run dev:landing-static
```

The dev server supports all the same features as production (i18n, themes, etc.) but runs with hot module replacement for instant feedback.

### Preview (local production build)

```bash
cd apps/landing-static
bun run build && bun run start
# → Serves out/ on http://localhost:3004
```

This is the closest thing to a production deployment you can test locally.

### Production

#### Generic static host

```bash
# 1. Build with production URLs
NEXT_PUBLIC_SITE_URL=https://www.example.com \
NEXT_PUBLIC_WEB_APP_URL=https://app.example.com \
bun run build

# 2. Upload the out/ directory to your host
# The out/ directory IS your site — it's fully self-contained.
```

#### AWS S3 + CloudFront

```bash
# Build
NEXT_PUBLIC_SITE_URL=https://www.example.com \
NEXT_PUBLIC_WEB_APP_URL=https://app.example.com \
bun run build

# Sync to S3
aws s3 sync out/ s3://your-bucket-name \
  --delete \
  --cache-control "public, max-age=0, must-revalidate"

# Set long-lived cache on hashed assets
aws s3 cp s3://your-bucket-name/_next/ s3://your-bucket-name/_next/ \
  --recursive \
  --cache-control "public, max-age=31536000, immutable" \
  --metadata-directive REPLACE

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*"
```

**S3 bucket configuration:**
- Enable static website hosting
- Set index document to `index.html`
- Set error document to `404.html`

**CloudFront configuration:**
- Origin: S3 bucket (use the website endpoint, not the REST endpoint, for trailing slash support)
- Default root object: `index.html`
- Custom error response: 404 → `/404.html` (status 404)
- Add the security headers listed above via a Response Headers Policy

#### Netlify

```toml
# netlify.toml (place in apps/landing-static/)
[build]
  command = "bun run build"
  publish = "out"

[build.environment]
  NEXT_PUBLIC_SITE_URL = "https://www.example.com"
  NEXT_PUBLIC_WEB_APP_URL = "https://app.example.com"

[[headers]]
  for = "/_next/static/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

#### Cloudflare Pages

```bash
# Build command: bun run build
# Build output directory: apps/landing-static/out
# Environment variables: set NEXT_PUBLIC_SITE_URL and NEXT_PUBLIC_WEB_APP_URL
```

Cloudflare Pages automatically handles trailing slashes, Brotli compression, and immutable caching for hashed assets.

#### Vercel (static)

Vercel auto-detects Next.js and handles `output: "export"` natively:

```bash
# Install Vercel CLI
bun add -g vercel

# Deploy (from apps/landing-static/)
vercel --prod
```

Set the environment variables in the Vercel dashboard under Project Settings > Environment Variables.

#### GitHub Pages

```yaml
# .github/workflows/deploy-landing-static.yml
name: Deploy Landing Static
on:
  push:
    branches: [main]
    paths: ['apps/landing-static/**', 'packages/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run build
        working-directory: apps/landing-static
        env:
          NEXT_PUBLIC_SITE_URL: https://yourorg.github.io/your-repo
          NEXT_PUBLIC_WEB_APP_URL: https://app.example.com
      - uses: actions/upload-pages-artifact@v3
        with:
          path: apps/landing-static/out
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Testing

```bash
# Unit tests (Bun)
bun run test

# Component tests (Vitest + React Testing Library)
bun run test:unit

# E2E tests (Playwright — requires build first)
bun run build && bun run test:e2e

# Type checking
bun run typecheck

# Linting
bun run lint

# Bundle size check
bun run size
```

## Directory structure

```
apps/landing-static/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (CSS import)
│   │   ├── globals.css             # Imports design system styles
│   │   ├── icon.tsx                # Favicon (generated at build time)
│   │   ├── robots.ts              # robots.txt (generated at build time)
│   │   ├── sitemap.ts             # sitemap.xml (generated at build time)
│   │   └── [locale]/              # Locale-parameterized routes
│   │       ├── layout.tsx          # HTML shell, i18n provider, theme
│   │       ├── page.tsx            # Homepage (hero + CTA)
│   │       ├── about/page.tsx      # About page
│   │       ├── privacy/page.tsx    # Privacy policy
│   │       └── terms/page.tsx      # Terms of service
│   ├── components/
│   │   ├── site-header.tsx         # Navigation header + locale switcher
│   │   ├── footer.tsx              # Footer with legal links
│   │   ├── locale-switcher.tsx     # Language selector dropdown
│   │   └── content-page-layout.tsx # Legal page wrapper
│   └── i18n/
│       └── request.ts             # Re-exports @repo/i18n/request
├── qa/
│   ├── tests/                     # Unit + component tests
│   └── e2e/                       # Playwright E2E specs
├── out/                           # Build output (deploy this!)
├── next.config.ts                 # output: "export", trailingSlash, etc.
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── vitest.config.ts
├── playwright.config.ts
├── .env.example
└── .size-limit.json               # Bundle size budgets
```
