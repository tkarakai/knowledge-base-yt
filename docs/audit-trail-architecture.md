# Audit Trail Architecture

## 1. Purpose & Principles

The audit trail is a **general-purpose, single-table event log**. Its job is to:

1. **Capture events** — efficiently and performantly accept event creation requests
2. **Store events** — persist them reliably in an append-only table
3. **Surface events** — allow authorized users (admins) to observe and filter events

The audit trail does **not**:

- Interpret events (e.g. determine if an action is suspicious)
- React to events (e.g. trigger alerts, block users)
- Validate business logic (e.g. check if a user has permission for an action)

These concerns belong to separate analysis/monitoring services that read from the audit trail.

### Core Invariants

- **Append-only** — events are never updated or deleted
- **Non-blocking** — audit trail writes never block or fail the business operation that triggered them
- **Non-forgeable identity** — `authenticatedUserId` is injected by the audit trail from the verified session, not provided by the caller
- **Nullable identity by design** — `authenticatedUserId` is intentionally nullable. Unauthenticated events (waitlist joins, token claims, failed logins) are first-class citizens, not edge cases
- **Source transparency** — the `source` field's transport prefix (`web:` or `server:`) is set by the audit trail based on which entry point was used, not by the caller

---

## 2. Schema

### Table: `auditTrail`

| Field | Type | Required | Set by | Description |
|-------|------|----------|--------|-------------|
| `_id` | `Id<"auditTrail">` | Yes | Convex | Unique identifier (Convex system field) |
| `_creationTime` | `number` | Yes | Convex | When the server received/stored the event (Convex system field) |
| `happenedAt` | `number` | Yes | Caller / Audit trail | When the event occurred. Caller can provide; defaults to `Date.now()` |
| `authenticatedUserId` | `string?` | No | Audit trail | Better Auth user ID. Auto-injected from session for web events. Null for unauthenticated or system events |
| `actor` | `string` | Yes | Caller / Audit trail | Informational display field — email, "system", service name, etc. Auto-populated from session email for web events |
| `source` | `string` | Yes | Audit trail | Origin of the event. Format: `transport:detail`. Transport (`web`/`server`) is set by the entry point; detail is provided by the caller |
| `action` | `string` | Yes | Caller | What happened. Must match `AUDIT_ACTIONS` enum. Hierarchical dot notation (e.g. `auth.sign_in`, `admin.user.banned`) |
| `resource` | `string` | Yes | Caller | What was affected. Convention: `type:id` (e.g. `session:abc123`, `user:xyz`). Accepted as-is |
| `status` | `string` | Yes | Caller | Outcome of the action. Must match `AUDIT_STATUSES` enum. Hierarchical dot notation (e.g. `succeeded`, `failed.wrong_password`) |
| `oldValue` | `string?` | No | Caller | Previous state (JSON string) |
| `newValue` | `string?` | No | Caller | New state (JSON string) |
| `reason` | `string?` | No | Caller | Why it happened |
| `meta` | `string?` | No | Caller | Additional context (JSON string — e.g. IP address, user agent) |
| `truncatedFields` | `string?` | No | Audit trail | Comma-separated list of field names that were truncated due to length limits |

### Field Length Limits

The audit trail enforces maximum field lengths. Fields exceeding the limit are **truncated** (not rejected), and the field name is recorded in `truncatedFields`.

| Field | Max Length |
|-------|-----------|
| `actor` | 500 |
| `action` | 100 |
| `resource` | 500 |
| `status` | 200 |
| `oldValue` | 10,000 |
| `newValue` | 10,000 |
| `reason` | 2,000 |
| `meta` | 5,000 |

### Indexes

| Index | Fields | Purpose |
|-------|--------|---------|
| `by_happenedAt` | `happenedAt` | Default chronological listing |
| `by_action_happenedAt` | `action`, `happenedAt` | Filter by action |
| `by_actor_happenedAt` | `actor`, `happenedAt` | Filter by actor |
| `by_source_happenedAt` | `source`, `happenedAt` | Filter by source |
| `by_status_happenedAt` | `status`, `happenedAt` | Filter by status |
| `by_action_status_happenedAt` | `action`, `status`, `happenedAt` | Combined action+status filter |
| `by_authenticatedUserId_happenedAt` | `authenticatedUserId`, `happenedAt` | Filter by authenticated user |

Indexes serve admin UI filtering needs. They can be adjusted as new filtering requirements emerge — this is not an architectural decision.

---

## 3. Entry Points

### `insertEvent` — Server-Side (internalMutation)

Used by server-side code: auth hooks, admin mutations, cron jobs, internal services.

- Only callable from Convex actions, HTTP handlers, or other internal functions (enforced by Convex runtime)
- Caller provides `sourceDetail` (e.g. `"auth-hook"`, `"admin-mutation"`, `"cron-job"`)
- Audit trail constructs `source = "server:" + sourceDetail`
- `authenticatedUserId` is optional — null for system/cron events

### `postEvent` — Client-Side (authedMutation)

Used by authenticated web clients via the Convex WebSocket.

- Requires valid session (enforced by `authedMutation` wrapper)
- Caller provides `sourceDetail` optionally (e.g. `"dashboard"`, `"settings"`)
- Audit trail constructs `source = "web:" + (sourceDetail ?? "")`
- `authenticatedUserId` is auto-injected from the session — caller cannot override
- `actor` is auto-populated from the session user's email — caller cannot override

### Source Format

The `source` field uses a two-part format: `transport:detail`

- **Transport** (enum-enforced): `web` | `server`
- **Detail** (free-form): caller-provided context string

Examples: `server:auth-hook`, `server:admin-mutation`, `server:cron-cleanup`, `web:dashboard`, `web:settings`

The transport prefix is always set by the audit trail based on which entry point was used. This prevents web clients from claiming to be server events.

### Client-Side `postEvent` vs Server-Side Auth Hooks

Better Auth's database hooks (`session.create.after`, `user.update.after`, etc.) already capture many successful auth operations server-side via `insertEvent`. Given this overlap, here is the rationale for when client-side `postEvent` adds value and when it is redundant.

#### What client-side `postEvent` adds

1. **Failure visibility** — Server-side hooks only fire on *successful* operations (e.g. a successful password change triggers `user.update.after`). Client-side `postEvent` in `finally` captures failures too (`failed.wrong_password`, `failed.invalid_code`, `failed.unknown`), which are invisible to hooks.

2. **Client context (`sourceDetail`)** — Client-side events carry the UI origin (`web:settings`, `admin`, `admin-settings`) whereas hooks only know `server:auth-hook`. This distinguishes "admin banned a user from the admin dashboard" from "system operation" in the audit log.

3. **Operations without corresponding hooks** — Not every Better Auth API call has a matching database hook. Admin operations (`banUser`, `unbanUser`, `removeUser`, `setRole`, `revokeSession`, `revokeSessions`) and self-service session revocation may not trigger hooks, making client-side auditing the only coverage.

---

## 4. Unauthenticated Events

### Why They Matter

Some of the most security-relevant events happen **before** a user is authenticated:

- Joining a waitlist (no account exists yet)
- Claiming an invitation token (clicking a link from an email)
- Failed login attempts (wrong password, non-existent email)
- Banned user access attempts
- Using expired or revoked tokens

Requiring authentication for audit logging would create a blind spot over exactly the activity that matters most for security monitoring. The `authenticatedUserId` field is **intentionally nullable** to support these events as first-class citizens.

### How They Flow

All unauthenticated events go through `insertEvent` (internalMutation) → `server:*` source. They **cannot** go through `postEvent` (which requires an authenticated session via `authedMutation`).

```
Unauthenticated user action
  → Server-side code (mutation, action, HTTP handler)
    → scheduleAuditEvent(ctx, { ... }) or runAuditEvent(actionCtx, { ... })
      → insertEvent (internalMutation)
        → source = "server:{detail}"
        → authenticatedUserId = undefined
```

### The `actor` Field: Verified vs Claimed Identity

The meaning of the `actor` field depends on whether `authenticatedUserId` is present:

| `authenticatedUserId` | `actor` meaning | Trust level |
|----------------------|-----------------|-------------|
| Present | Verified identity — auto-populated from session email | **Verified** by the auth system |
| Absent | Claimed/informational — the email they typed, an IP address, "anonymous", etc. | **Untrusted** — it's what they claim, not who they are |

The admin UI reflects this distinction with a shield icon next to the actor when `authenticatedUserId` is present.

### Examples

| Event | `authenticatedUserId` | `actor` | `source` | `action` |
|-------|----------------------|---------|----------|----------|
| User joins waitlist | `undefined` | `"user@example.com"` | `server:waitlist` | `waitlist.joined` |
| User claims invitation token | `undefined` | `"user@example.com"` | `server:waitlist-token` | `waitlist.token.claimed` |
| Admin invites waitlist entry | `"admin-user-id"` | `"admin@example.com"` | `server:admin-mutation` | `waitlist.invitation.sent` |
| Successful sign-in | `"user-id"` | `"user@example.com"` | `server:auth-hook` | `auth.sign_in` |

### Known Gap: Auth Failure Logging

Better Auth's `databaseHooks` only fire on **successful** operations (e.g. `session.create.after` fires when a session is created — which only happens on successful login). Failed login attempts don't create sessions, so the hook never fires.

Capturing auth failures requires a custom Better Auth plugin that intercepts responses from auth endpoints (e.g. `/sign-in/email`) and logs failed attempts. This is planned for a follow-up implementation.

---

## 5. Validation

### What the Audit Trail Validates

| Check | Behavior |
|-------|----------|
| Mandatory fields present | Throw error if missing |
| `action` matches `AUDIT_ACTIONS` enum | Throw error if unknown |
| `status` matches `AUDIT_STATUSES` enum | Throw error if unknown |
| Source transport matches `AUDIT_SOURCE_TRANSPORTS` enum | Throw error if unknown |
| Field length limits | **Truncate** (not reject) and record in `truncatedFields` |

### What the Audit Trail Does NOT Validate

- Whether the action is appropriate for the actor (e.g. a regular user sending an `admin.*` action)
- Whether the `resource` ID actually exists
- Whether `oldValue`/`newValue` JSON is well-formed
- Whether `meta` fields (IP, user agent, etc.) are valid or manipulated
- Whether the `happenedAt` timestamp is reasonable

Validation of caller-provided content (e.g. sanitizing user agent strings, verifying resource IDs) is the **caller's responsibility**.

---

## 6. Service Architecture

### Import Pattern

The audit trail is an internal service within the Convex backend package. Other modules consume it via:

```typescript
// For types and constants
import { AUDIT_ACTIONS, AUDIT_STATUSES, type AuditAction, type AuditStatus } from "./auditTrailConstants";

// For the helper functions (in a separate file to avoid circular deps)
import { scheduleAuditEvent, runAuditEvent } from "./auditTrailHelpers";
```

Apps outside the backend package access constants and helpers via:

```typescript
import {
  AUDIT_ACTIONS, AUDIT_STATUSES,
  type AuditAction, type AuditStatus,
  scheduleAuditEvent, runAuditEvent,
} from "@repo/backend";
```

**Note**: The helpers live in `auditTrailHelpers.ts` (not `auditTrail.ts`) to avoid a circular dependency — `auditTrail.ts` defines `insertEvent`, and `internal.auditTrail.insertEvent` references it back, which breaks module resolution in convex-test.

### Helper Functions

Two helpers are provided, one for each execution context:

#### `scheduleAuditEvent(ctx, event)` — For Mutation Contexts

Use when writing audit events from Convex **mutations**. Fires the event asynchronously via `ctx.scheduler.runAfter(0, ...)` so it runs in a separate transaction and never blocks or fails the calling mutation.

```typescript
import { scheduleAuditEvent } from "./auditTrailHelpers";

// Inside a mutation handler:
await scheduleAuditEvent(ctx, {
  actor: ctx.ownerId,
  authenticatedUserId: ctx.ownerId,
  sourceDetail: "task-mutation",
  action: "user.task_created",
  resource: `task:${taskId}`,
  status: "succeeded",
});
```

#### `runAuditEvent(actionCtx, event)` — For Action Contexts

Use when writing audit events from Convex **actions** (e.g. auth hooks, HTTP actions). In action contexts, `ctx.scheduler` is not available, so this helper uses `actionCtx.runMutation()` directly. The mutation call is already in a separate transaction from the action.

```typescript
import { runAuditEvent } from "./auditTrailHelpers";

// Inside an action handler or auth hook:
await runAuditEvent(actionCtx, {
  actor: email,
  authenticatedUserId: userId,
  sourceDetail: "auth-hook",
  action: "auth.sign_in",
  resource: `session:${sessionId}`,
  status: "succeeded",
  meta: JSON.stringify({ ip, userAgent }),
});
```

Both helpers wrap the call in `try/catch` and log failures to the console. They never throw.

---

## 7. Business Service Developer Guide

### The Non-Negotiable Pattern

When adding audit trail events to business logic, you **must** follow this pattern:

```typescript
export const doSomething = authedMutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    let result: SomeResult | undefined;
    let error: unknown;
    let status: AuditStatus = "succeeded";

    try {
      // === Business logic ===
      result = await performBusinessOperation(ctx, args);
    } catch (e) {
      error = e;
      status = "failed.internal_error"; // or a more specific status
    } finally {
      // === Audit trail event — ALWAYS in finally ===
      await scheduleAuditEvent(ctx, {
        actor: ctx.ownerId,
        authenticatedUserId: ctx.ownerId,
        sourceDetail: "my-service",
        action: "domain.operation",
        resource: `entity:${entityId}`,
        status,
        oldValue: JSON.stringify(oldState),
        newValue: result ? JSON.stringify(result) : undefined,
        reason: error instanceof Error ? error.message : undefined,
      });
    }

    // Re-throw if there was an error
    if (error) throw error;
    return result;
  },
});
```

### Rules

1. **Always wrap in try/catch/finally** — the entire code of interest goes in the `try` block
2. **Audit event creation ALWAYS goes in `finally`** — guarantees the event attempt is logged even if an error occurs
3. **`scheduleAuditEvent`/`runAuditEvent` already handle their own try/catch** — if the audit call itself fails, it logs to console and continues. The business operation is never affected
4. **Use async writes** — `scheduleAuditEvent` uses the scheduler (fire-and-forget); `runAuditEvent` calls `runMutation` which is a separate transaction
5. **Set the status appropriately** — use `"succeeded"` for success, `"failed.*"` for failures, matching the `AUDIT_STATUSES` enum

### Choosing the Right Helper

| Context | Helper | Why |
|---------|--------|-----|
| Mutation handler | `scheduleAuditEvent(ctx, ...)` | Uses `ctx.scheduler.runAfter(0, ...)` — separate transaction, fire-and-forget |
| Action handler / Auth hook | `runAuditEvent(actionCtx, ...)` | Uses `actionCtx.runMutation(...)` — scheduler not available in actions |

---

## 8. Action & Status Enum Management

### Convention

Both `action` and `status` use **hierarchical dot notation**:

- Dots (`.`) separate hierarchy levels
- Underscores (`_`) separate words within a level
- Actions describe **what happened** (never the outcome)
- Statuses describe **the outcome** (never the action)

#### Action Examples

```
auth.sign_in          — top-level: auth, action: sign_in
auth.two_factor.enabled — top-level: auth, group: two_factor, action: enabled
admin.user.banned     — top-level: admin, group: user, action: banned
user.profile_updated  — top-level: user, action: profile_updated
```

#### Status Examples

```
succeeded                — simple success
failed.wrong_password    — failure category: wrong_password
failed.rate_limited      — failure category: rate_limited
failed.internal_error    — failure category: internal_error
```

### Adding New Actions or Statuses

1. Open `packages/backend/convex/auditTrailConstants.ts`
2. Add the new value to `AUDIT_ACTIONS` or `AUDIT_STATUSES` array
3. The type union updates automatically (`AuditAction` / `AuditStatus`)
4. Deploy — old string values in the database are unaffected
5. Call sites get TypeScript type-checking for the new value

Both enums are **runtime-enforced** — the audit trail throws if an unknown action or status is received. This catches typos and misuse early.

### Why Centralized?

The enums live in one file (`auditTrailConstants.ts`) for:

- **Discoverability** — one place to see all auditable events and outcomes
- **Consistency** — naming conventions are visible and reviewable
- **Type safety** — TypeScript ensures callers use valid values
- **UI support** — the admin dashboard renders hierarchical dropdowns from these enums

---

## 9. Security Model

### What's Enforced

| Concern | Enforcement |
|---------|-------------|
| **Identity** | `authenticatedUserId` is injected from the verified session — cannot be forged |
| **Source** | Transport prefix (`web:`/`server:`) is set by the entry point — cannot be spoofed |
| **Authentication** | `postEvent` requires a valid session (via `authedMutation`) |
| **Authorization for reads** | `list` query returns empty for non-admin users |
| **Append-only** | No update or delete mutations exist |

### What's Accepted (Not Rejected)

A web-based event that appears inappropriate (e.g. a regular user sending an `admin.user.banned` action) is **accepted and recorded**. The `authenticatedUserId` clearly identifies the user as non-admin. It is the job of an independent analysis/audit process to identify such mismatches.

The audit trail is a **faithful recorder**, not a **gatekeeper**.

### Unauthenticated Event Security

For events without `authenticatedUserId`:

- The `actor` field is **untrusted** — it contains whatever the caller provides (e.g. the email address someone typed into a login form). It could be fabricated.
- The absence of `authenticatedUserId` is itself meaningful — it signals that no verified session backs this event.
- The `source` field is always `server:*` for unauthenticated events (they can only come through `insertEvent`), which confirms they originated from server-side code, not from a client.
- The `meta` field typically captures request context (IP address, user agent) for forensic analysis.

This is a **feature, not a limitation**. The distinction between verified and unverified identity is exactly what security analysis needs.

### Server-Side Security

`insertEvent` is an `internalMutation` — only callable from server-side Convex code. The Convex runtime enforces this; clients cannot call internal functions.

---

## 10. Indexing Strategy

Indexes are designed around admin UI filtering needs. The current set covers:

- Chronological listing (default)
- Filter by single field: action, actor, source, status, authenticatedUserId
- Combined filter: action + status

As new filtering patterns emerge (e.g. resource prefix search, time range + source), new indexes can be added. This is an operational decision, not an architectural one.

---

## 11. Admin UI

The admin dashboard (`apps/admin`) provides:

- **Paginated listing** — reverse chronological, 50 items per page, load-more pagination
- **Filtering** — by action, source, status (hierarchical dropdown rendering)
- **Actor display** — shows the `actor` field (email/system name) with an icon indicating whether `authenticatedUserId` is present
- **Event details** — expandable view showing all fields including oldValue, newValue, meta (JSON-formatted), and truncatedFields
- **Truncation indicator** — visual indicator when fields were truncated

The admin UI is read-only. It queries via `api.auditTrail.list` which returns empty for non-admin users (safe for reactive subscriptions).
