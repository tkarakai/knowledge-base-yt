# Architecture Patterns

> Detailed guide for AI agents. See `CLAUDE.md` for the quick reference.

## Route Protection (Authentication)

The web app uses a **three-layer** auth system. New protected pages get all three layers automatically by placing them under `src/app/(dashboard)/`.

| Layer | Where | What it does | Speed |
|-------|-------|-------------|-------|
| **Proxy** | `src/proxy.ts` | Cookie-presence check + CSP headers (Edge) | ~1ms |
| **Layout** | `src/app/(dashboard)/layout.tsx` | Full session validation + user preload (RSC) | ~50ms |
| **AuthGuard** | `src/components/auth/auth-guard.tsx` | Client-side session watcher + redirect | Ongoing |

**To add a new protected page:** just create it under `src/app/(dashboard)/`:

```
src/app/(dashboard)/
  layout.tsx          <- auth check (already exists, shared by all pages)
  dashboard/page.tsx  <- existing page
  settings/page.tsx   <- new page -- automatically protected!
```

**To access the current user** in any client component under `(dashboard)/`:

```typescript
import { useAuthUser } from "@/components/auth/auth-guard";

export function MyComponent() {
  const user = useAuthUser(); // { name?, email? } | null
  return <span>{user?.name ?? "Anonymous"}</span>;
}
```

**How the layers work together:**

1. **Proxy** (Edge, instant): Checks for the `better-auth.session_token` cookie. No cookie -> redirect to `/sign-in`. Also redirects authenticated users away from `/sign-in` and `/sign-up` to `/dashboard`. Sets CSP headers with nonce.
2. **Layout** (Server Component): Calls `isAuthenticated()` for full session validation, then `preloadAuthQuery(api.auth.getCurrentUser)` to SSR the user data. Catches stale-session errors (e.g. signed out in another tab) and redirects.
3. **AuthGuard** (Client Component): Subscribes to the Convex user query for real-time updates and watches the Better Auth session. If the session is invalidated while the page is open, redirects immediately.

**Backend safety:** The `getCurrentUser` Convex query returns `null` (not throws) when unauthenticated, so client-side subscriptions degrade gracefully instead of crashing.

**To add a route to proxy protection:** edit the `PROTECTED_PREFIXES` array in `src/proxy.ts`. Auth-page redirects use the `AUTH_ROUTES` array.

## Guest Pages (Auth Pages)

Auth pages (`/sign-in`, `/sign-up`) are wrapped by `GuestGuard` via `src/app/(auth)/layout.tsx`. When a user logs in on another tab:

1. **BroadcastChannel** (instant): The auth form calls `broadcastAuth()` on success. Other tabs' `GuestGuard` receives the message and redirects to `/dashboard`.
2. **Visibility fallback**: When the tab becomes visible, `GuestGuard` calls `authClient.getSession()` to check for an active session and redirects if found.

**To broadcast auth from a new login flow:** call `broadcastAuth()` from `@/lib/auth-broadcast` after successful authentication.

## Rate Limiting

The application uses three layers of rate limiting. See `RATE-LIMITING.md` in the project root for the full architecture document.

| Layer | Scope | Storage | Config |
|-------|-------|---------|--------|
| **Better Auth** | Auth endpoints (sign-in, sign-up) | Convex DB (betterAuth component `rateLimit` table) | `packages/backend/convex/auth.ts` — env vars via `convex env set` |
| **Convex Functions** | All `authedMutation` calls | Convex DB (`rateLimits` table) | `packages/backend/convex/rateLimits.ts` — env vars via `convex env set` |
| **Edge Proxy** | HTTP page requests (web, admin, landing) | In-memory `Map` (per-instance, capped) | `apps/*/src/proxy.ts` — uses shared `@repo/edge-rate-limit` package |

**Key files:**
- `packages/backend/convex/rateLimits.ts` — Convex rate limit definitions
- `packages/backend/convex/functions.ts` — Global mutation rate limit in `authedMutation`
- `packages/edge-rate-limit/` — Shared edge rate limiter (used by web, admin, and landing proxies)
- `apps/web/src/components/auth/auth-form.tsx` — Client-side 429 error handling

> **Note**: `landing-static` is a fully static export and does not use edge rate limiting. Rate limiting for static deployments should be handled at the CDN/hosting layer.

**What happens when rate limited:**
- **Auth endpoints**: HTTP 429, auth form shows "Too many attempts. Please wait a moment before trying again."
- **Convex mutations**: `ConvexError` with `{ kind: "RateLimited" }`, `useQuery` subscriptions unaffected
- **Edge proxy**: HTTP 429 with `Retry-After` header, plain "Too Many Requests" page

**Queries are NOT rate limited** — they are read-only and used by `useQuery` real-time subscriptions.

## Client vs Server Components

```typescript
// Server Component (default) - no directive needed
// Can use: async/await, direct database access, server-only code
export default async function ServerPage() {
  const data = await fetchData();
  return <div>{data}</div>;
}

// Client Component - requires directive
"use client";
// Can use: useState, useEffect, event handlers, browser APIs
export function ClientComponent() {
  const [state, setState] = useState(false);
  return <button onClick={() => setState(true)}>Click</button>;
}
```

## Convex React Hooks

```typescript
"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/backend";

export function MyComponent() {
  // Queries subscribe to real-time updates
  const items = useQuery(api.launchItems.list);

  // Mutations for creating/updating/deleting
  const createItem = useMutation(api.launchItems.create);

  const handleCreate = async () => {
    await createItem({ title: "New Item" });
  };

  if (items === undefined) return <Loading />;
  return <ItemList items={items} onCreate={handleCreate} />;
}
```
