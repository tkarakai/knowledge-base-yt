# Rate Limiting Architecture

This document describes the rate limiting implementation across the application stack.

## Overview

Rate limiting is implemented at three layers, each targeting a different attack surface and operating at a different point in the request lifecycle.

```
Client Request
  │
  ▼
┌─────────────────────────────────────┐
│  Layer 3: Edge Proxy                │  ← Per-IP, in-memory, first line of defense
│  (Next.js proxy.ts)                 │
│  apps/web/src/proxy.ts              │
│  apps/landing/src/proxy.ts          │
└──────────────┬──────────────────────┘
               │
  ┌────────────┴────────────┐
  │                         │
  ▼                         ▼
┌──────────────┐    ┌──────────────────┐
│ Page Routes  │    │ /api/auth/*      │
│ (React)      │    │ (Better Auth)    │
└──────┬───────┘    └────────┬─────────┘
       │                     │
       ▼                     ▼
┌──────────────┐    ┌──────────────────┐
│  Layer 2     │    │  Layer 1         │  ← Per-IP, database-backed
│  Convex      │    │  Better Auth     │
│  Mutations   │    │  Rate Limiting   │
│  (per-user)  │    │                  │
└──────────────┘    └──────────────────┘
```

## Layer 1: Better Auth (Authentication Endpoints)

**Scope**: All Better Auth HTTP endpoints (`/api/auth/*`)

**How it works**: Better Auth's built-in rate limiting, configured in the `betterAuth()` options. Uses the `rateLimit` table automatically provisioned by the `@convex-dev/better-auth` Convex component. Rate limiting is per-IP address, extracted from the `x-forwarded-for` header.

**Configuration file**: `packages/backend/convex/auth.ts`

### Default Limits

| Endpoint | Window | Max Requests | Purpose |
|----------|--------|-------------|---------|
| Global (all auth endpoints) | 60s | 100 | General abuse prevention |
| `/sign-in/email` | 10s | 3 | Brute-force protection |
| `/sign-up/email` | 60s | 5 | Spam account prevention |
| `/get-session` | — | Unlimited | Required for real-time session polling |

### Environment Variables

Set via `convex env set <KEY> <VALUE>`:

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_RATE_LIMIT_WINDOW` | `60` | Global window in seconds |
| `AUTH_RATE_LIMIT_MAX` | `100` | Global max requests per window |
| `AUTH_RATE_LIMIT_SIGNIN_WINDOW` | `10` | Sign-in window in seconds |
| `AUTH_RATE_LIMIT_SIGNIN_MAX` | `3` | Sign-in max attempts per window |
| `AUTH_RATE_LIMIT_SIGNUP_WINDOW` | `60` | Sign-up window in seconds |
| `AUTH_RATE_LIMIT_SIGNUP_MAX` | `5` | Sign-up max attempts per window |

### What Happens When Rate Limited

- **Server**: Returns HTTP 429 with `X-Retry-After` header (seconds until retry).
- **Client**: The `authClient` global `onError` handler logs a warning to the console. The `signIn.email()` / `signUp.email()` call returns `{ error: { status: 429, message: "Too many requests" } }`.
- **User sees**: The auth form displays "Too many attempts. Please wait a moment before trying again." The form button returns to its normal state.
- **Recovery**: Automatic — wait for the window to expire, then retry.

---

## Layer 2: Convex Functions (Mutations)

**Scope**: All authenticated mutations (every function built with `authedMutation`)

**How it works**: Uses `convex-helpers/server/rateLimit` with `defineRateLimits`. A single global rate limit (`mutationGlobal`) is checked in the `authedMutation` builder, so every mutation call is rate limited per user. The token state is stored in the `rateLimits` table in the Convex database (persistent, works across all Convex instances).

**Configuration files**:
- `packages/backend/convex/rateLimits.ts` — Rate limit definitions
- `packages/backend/convex/functions.ts` — Integration in `authedMutation`
- `packages/backend/convex/schema.ts` — `rateLimitTables` spread into schema

### Default Limits

| Name | Algorithm | Rate | Period | Burst Capacity | Scope |
|------|-----------|------|--------|----------------|-------|
| `mutationGlobal` | Token bucket | 30 tokens/min | 60s | 10 tokens | Per user (`ownerId`) |

Token bucket means: tokens accumulate continuously at 30/minute. Users can make up to 10 requests in quick succession (burst), then must wait for tokens to replenish. This allows normal interactive usage while blocking automated abuse.

### Why Not Rate Limit Queries?

Queries are read-only, idempotent, and used by `useQuery` real-time subscriptions. Rate limiting them would break reactive UI updates, causing subscriptions to fail when the user is simply viewing data.

### Environment Variables

Set via `convex env set <KEY> <VALUE>`:

| Variable | Default | Description |
|----------|---------|-------------|
| `MUTATION_RATE_LIMIT_RATE` | `30` | Tokens added per period |
| `MUTATION_RATE_LIMIT_PERIOD` | `60000` | Period in milliseconds |
| `MUTATION_RATE_LIMIT_CAPACITY` | `10` | Maximum burst capacity |

### What Happens When Rate Limited

- **Server**: `convex-helpers` throws a `ConvexError` with data `{ kind: "RateLimited", name: "mutationGlobal", retryAt: <timestamp> }`. The mutation is aborted — no database changes occur.
- **Client**: The `useMutation` promise rejects with a `ConvexError`. Components with try/catch show the error. `useQuery` subscriptions continue working normally.
- **User sees**: An error in the component that triggered the mutation. Real-time data remains live and updating.
- **Recovery**: Wait for tokens to replenish (refills at 30/minute).

### Handling ConvexError in Components

Pattern for catching rate limit errors in mutation-calling components:

```typescript
import { ConvexError } from "convex/values";

try {
  await createProject({ name, description });
} catch (err) {
  if (err instanceof ConvexError) {
    const data = err.data as { kind?: string; retryAt?: number };
    if (data?.kind === "RateLimited") {
      const waitSeconds = data.retryAt
        ? Math.ceil((data.retryAt - Date.now()) / 1000)
        : 5;
      setError(`Too many requests. Please wait ${waitSeconds} seconds.`);
      return;
    }
  }
  setError("An error occurred.");
}
```

---

## Layer 3: Edge Proxy (HTTP Requests)

**Scope**: All HTTP page requests to the web and landing apps (excludes API routes, static assets, and prefetch requests)

**How it works**: An in-memory fixed window counter (`Map<ip, {count, resetAt}>`) in the Next.js proxy (Edge Runtime). Checks happen before auth redirects and CSP header generation, so abusive requests are rejected immediately with minimal processing.

**Configuration files**:
- `apps/web/src/proxy.ts` — Web app proxy integration
- `apps/landing/src/proxy.ts` — Landing app proxy integration
- `apps/web/src/lib/edge-rate-limit.ts` — Rate limiter utility (identical copy in landing)

### Default Limits

| App | Window | Max Requests | Map Size Cap |
|-----|--------|-------------|-------------|
| Web | 60s | 200 | 10,000 IPs |
| Landing | 60s | 300 | 10,000 IPs |

Landing has a higher default because marketing pages typically see higher legitimate traffic (crawlers, social media previews, etc.) and have no auth endpoints.

### Environment Variables

Set in `.env.local` or deployment config:

| Variable | Default (web) | Default (landing) | Description |
|----------|-------------|-------------------|-------------|
| `EDGE_RATE_LIMIT_WINDOW` | `60` | `60` | Window in seconds |
| `EDGE_RATE_LIMIT_MAX` | `200` | `300` | Max requests per window |
| `EDGE_RATE_LIMIT_MAP_MAX_SIZE` | `10000` | `10000` | Max tracked IPs |

### Map Size Cap and Fail-Closed Behavior

The in-memory IP tracker has a configurable maximum size (default 10,000 entries). This prevents memory exhaustion from DDoS attacks using many unique IPs.

**When the map is full:**
1. A cleanup pass runs, evicting expired entries
2. If the map is still at capacity, **new IPs are rejected with 429** (fail-closed)
3. Existing tracked IPs continue to be served normally

This is the conservative approach — if we're tracking 10k unique IPs within 60 seconds, something abnormal is happening. Blocking new IPs is safer than allowing potential attackers through.

### Limitations

- **Per-instance only**: Each serverless/edge instance has its own counter. The effective limit scales with the number of instances.
- **Not persistent**: Counters reset on deployment. This is acceptable because the edge layer is a first line of defense, not the primary rate limiting.
- **Excluded routes**: API routes (`/api/*`), static assets (`/_next/static/*`, `/_next/image/*`), and prefetch requests are not rate limited at the edge. API routes are protected by Layer 1 (Better Auth).

### What Happens When Rate Limited

- **Server**: Returns HTTP 429 with headers:
  - `Retry-After`: Seconds until the window resets
  - `X-RateLimit-Limit`: Maximum requests per window
  - `X-RateLimit-Remaining`: `0`
  - `X-RateLimit-Reset`: Unix timestamp (ms) when the window resets
- **Response body**: Plain text "Too Many Requests"
- **User sees**: A plain "Too Many Requests" page. This should only trigger under genuine abuse conditions (200+ page loads in 60 seconds is far beyond normal browsing).
- **Recovery**: Wait for the window to reset (default 60 seconds).

---

## Response Headers

All successful responses from the web and landing proxies include rate limit headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed per window |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Unix timestamp (ms) when the window resets |

These headers allow clients and monitoring tools to track rate limit status proactively.

---

## File Reference

| File | Purpose |
|------|---------|
| `packages/backend/convex/auth.ts` | Better Auth rate limit config (Layer 1) |
| `packages/backend/convex/rateLimits.ts` | Convex rate limit definitions (Layer 2) |
| `packages/backend/convex/functions.ts` | Global mutation rate limit in `authedMutation` (Layer 2) |
| `packages/backend/convex/schema.ts` | `rateLimitTables` added to schema (Layer 2) |
| `apps/web/src/proxy.ts` | Web app edge rate limiting (Layer 3) |
| `apps/landing/src/proxy.ts` | Landing app edge rate limiting (Layer 3) |
| `apps/web/src/lib/edge-rate-limit.ts` | Edge rate limiter utility |
| `apps/landing/src/lib/edge-rate-limit.ts` | Edge rate limiter utility (identical copy) |
| `packages/auth/src/client.ts` | Auth client 429 error logging |
| `apps/web/src/components/auth/auth-form.tsx` | Auth form rate limit error display |
| `apps/web/qa/tests/edge-rate-limit.test.ts` | Edge rate limiter unit tests |
| `apps/web/qa/tests/middleware.test.ts` | Proxy rate limiting integration tests |
| `packages/backend/convex/rateLimits.test.ts` | Convex rateLimits schema tests |

---

## Local Testing

You can set artificially low rate limits to manually trigger rate limiting in a running dev environment.

### Layer 1: Better Auth (sign-in/sign-up)

Set via the Convex CLI (run from `packages/backend/`):

```bash
cd packages/backend
bunx convex env set AUTH_RATE_LIMIT_SIGNIN_WINDOW 10
bunx convex env set AUTH_RATE_LIMIT_SIGNIN_MAX 1
bunx convex env set AUTH_RATE_LIMIT_SIGNUP_WINDOW 10
bunx convex env set AUTH_RATE_LIMIT_SIGNUP_MAX 1
```

**Test**: Go to `/sign-in`, attempt to sign in twice within 10 seconds. The second attempt returns HTTP 429 and the form shows "Too many attempts. Please wait a moment before trying again."

### Layer 2: Convex Mutations

Set via the Convex CLI (run from `packages/backend/`):

```bash
cd packages/backend
bunx convex env set MUTATION_RATE_LIMIT_RATE 1
bunx convex env set MUTATION_RATE_LIMIT_PERIOD 5000
bunx convex env set MUTATION_RATE_LIMIT_CAPACITY 1
```

**Test**: Sign in, open a project, and try creating/updating/deleting tasks rapidly (more than 1 action per 5 seconds). A red toast notification appears: "Too many requests. Please wait N seconds."

### Layer 3: Edge Proxy

Set in the app's `.env.local` file and restart the dev server:

```bash
# apps/web/.env.local
EDGE_RATE_LIMIT_WINDOW=5
EDGE_RATE_LIMIT_MAX=2
```

```bash
bun run dev:stop && bun run dev:web
```

**Test**: Rapidly refresh the page 3+ times within 5 seconds. You'll see a plain "Too Many Requests" response. The response headers include `Retry-After`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining`.

### Restoring Defaults

Remove the Convex environment variables (they fall back to code defaults):

```bash
cd packages/backend
bunx convex env unset AUTH_RATE_LIMIT_SIGNIN_WINDOW
bunx convex env unset AUTH_RATE_LIMIT_SIGNIN_MAX
bunx convex env unset AUTH_RATE_LIMIT_SIGNUP_WINDOW
bunx convex env unset AUTH_RATE_LIMIT_SIGNUP_MAX
bunx convex env unset MUTATION_RATE_LIMIT_RATE
bunx convex env unset MUTATION_RATE_LIMIT_PERIOD
bunx convex env unset MUTATION_RATE_LIMIT_CAPACITY
```

For edge rate limiting, remove or comment out the overrides in `.env.local` and restart:

```bash
bun run dev:stop && bun run dev:web
```

> **Note**: Convex env var changes take effect immediately (no restart needed). Edge env var changes require a dev server restart.
