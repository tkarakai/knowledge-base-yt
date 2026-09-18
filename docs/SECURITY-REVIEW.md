# Security Review: Web & Admin Apps

**Date:** 2026-02-09 (updated after merging latest main + applying fixes)
**Scope:** `apps/web/`, `apps/admin/`, `packages/backend/`, `packages/auth/`, `packages/edge-rate-limit/`

---

## Executive Summary

The codebase demonstrates strong security fundamentals: three-layer authentication, nonce-based CSP, multi-layer rate limiting, and proper access control patterns. All high-severity and actionable medium/low-severity issues have been resolved. The only remaining open items are **1 medium-severity** issue (email verification, deferred pending email provider setup) and **2 accepted risks** (Tailwind inline styles, per-instance edge rate limiter).

**Overall Security Posture: STRONG**

---

## Resolved Findings

| Original ID | Issue | Resolution |
|-------------|-------|------------|
| ~~H1~~ | Admin emails exposed to all authenticated users | **Fixed.** `adminEmails.listProtected` now checks `role !== "admin"` before returning emails (`adminEmails.ts:26-28`) |
| ~~M1~~ | Auth error messages enable email enumeration | **Fixed.** `formatAuthError` now returns generic "Invalid email or password" instead of server messages (`auth-form.tsx:32`) |
| ~~M2~~ | Admin app missing edge rate limiting | **Fixed.** Admin proxy now imports from shared `@repo/edge-rate-limit` package and applies `checkEdgeRateLimit()` (`admin/src/proxy.ts`) |
| ~~M3~~ | File upload name not sanitized | **Fixed.** `saveUpload` calls `assertMaxLength(args.name, MAX_NAME_LENGTH, "NAME")` (`files.ts:28`) |
| ~~M4~~ | User profile theme/timezone not validated | **Fixed.** `theme` validated against `["light", "dark", "system"]` allowlist; `timezone` validated with `assertMaxLength(..., 64)` (`userProfiles.ts:5-6, 52-58`) |
| ~~M6~~ | Admin role check uses `as any` type assertion | **Downgraded.** While `as any` is not ideal, the check `(x as any).role !== "admin"` is fail-secure: if the field is missing or renamed, `undefined !== "admin"` is `true` and access is denied. Acceptable risk. |
| ~~L1~~ | Missing `X-XSS-Protection` header | **Fixed.** Both apps now send `X-XSS-Protection: 0` to explicitly disable the browser's buggy XSS auditor in favor of CSP (`web/next.config.ts`, `admin/next.config.ts`) |
| ~~L4~~ | No file type whitelist on uploads | **Fixed.** `saveUpload` now rejects files whose content type is not in an allowlist of safe types (images, PDF, text, CSV, JSON, ZIP). Rejected files are deleted from storage (`files.ts`) |
| ~~L5~~ | Missing `Cache-Control` on session clear endpoint | **Fixed.** Both apps' `clear-session` routes now set `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` (`web/route.ts`, `admin/route.ts`) |
| ~~L6~~ | No string length limits on database fields | **Fixed.** `assertMaxLength` with `MAX_NAME_LENGTH` (255) and `MAX_DESCRIPTION_LENGTH` (5000) enforced across projects, tasks, and files |

Additionally, the edge rate limiting code was extracted into a shared `@repo/edge-rate-limit` package, eliminating duplication and ensuring consistent behavior across all apps.

---

## Open Findings

### MEDIUM SEVERITY

#### M5. Email verification disabled (deferred)

**File:** `packages/backend/convex/auth.ts:107-113`

```typescript
// TODO [SECURITY]: Set requireEmailVerification: true once an email provider
// (Resend, SendGrid, etc.) is configured with a sendVerificationEmail handler.
requireEmailVerification: false,
```

Users can sign up with any email address without verification. Combined with the auto-admin assignment in `databaseHooks.user.create.before`, an attacker who knows an admin email could register with it and get promoted to admin. The risk is **partially mitigated** because:
- The admin email list is restricted to admin-only access (`listProtected` fix)
- Sign-up is rate-limited to 5 attempts per 60 seconds
- Auth errors no longer reveal whether an email is registered

**Recommendation:** Enable email verification once an email provider is configured. As an interim measure, consider checking the `adminEmails` table in the `user.create.before` hook and rejecting sign-up attempts that would duplicate an existing admin email.

---

### ACCEPTED RISKS

#### L2. `style-src 'unsafe-inline'` in CSP

**Files:** `apps/web/src/proxy.ts:134`, `apps/admin/src/proxy.ts:64`

Both apps allow inline styles. This is a known trade-off required by Tailwind CSS v4 and is mitigated by the strict CSP on scripts.

#### L3. Edge rate limiter is per-instance only

**File:** `packages/edge-rate-limit/src/index.ts`

In-memory rate limiting is not shared across serverless instances. This is mitigated by the persistent Better Auth and Convex rate limiting layers and is documented in `RATE-LIMITING.md`.

---

## Strengths

| Area | Implementation | Assessment |
|------|----------------|------------|
| **Authentication** | Three-layer system (Proxy, Layout, Client AuthGuard) | Excellent |
| **CSP** | Nonce-based with `strict-dynamic`, `frame-ancestors 'none'` | Strong |
| **Security Headers** | HSTS (2yr), X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy | Comprehensive |
| **Rate Limiting** | Three layers: Edge (per-IP), Better Auth (per-endpoint), Convex (per-user) | Well-designed |
| **Edge Rate Limiting** | Shared `@repo/edge-rate-limit` package used by all apps; fail-closed; configurable via env vars | Consistent |
| **Access Control** | `authedQuery`/`authedMutation` wrappers, `requireProjectAccess()` | Consistent |
| **Input Validation** | `assertMaxLength` enforced across all string fields; file type whitelist on uploads | Thorough |
| **Error Handling** | Generic auth error messages prevent email enumeration | Secure |
| **Session Management** | HttpOnly cookies (Better Auth), multi-tab sync via BroadcastChannel, no-cache on session clear | Solid |
| **Admin Protection** | Protected admin plugin prevents modification of admin accounts; admin email list restricted to admins | Strong |
| **CI Security** | CodeQL, dependency audit, TruffleHog secrets scanning, license compliance | Thorough |
| **File Uploads** | Server-side size validation, name length validation, content-type whitelist, metadata from storage (not client) | Strong |
| **Redirect Safety** | All redirects use hardcoded paths, no user input in redirect URLs | Secure |

---

## Recommended Priority

| Priority | Issue | Effort |
|----------|-------|--------|
| **Fix when ready** | M5: Email verification disabled | Medium (requires email provider) |
| **Accept** | L2: style-src unsafe-inline (Tailwind) | N/A - documented trade-off |
| **Accept** | L3: Per-instance edge rate limiter | N/A - mitigated by backend layers |
