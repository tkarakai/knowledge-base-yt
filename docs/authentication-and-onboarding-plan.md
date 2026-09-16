# Authentication & Onboarding — Staged Implementation Plan

Staged plan for implementing [authentication-and-onboarding.md](./authentication-and-onboarding.md). Each stage leaves the app fully functional and independently verifiable. Low-hanging fruit first; higher complexity later.

---

## Stage 1: Session Config, trustDevice, HIBP, and `userMagicLinkEnabled` Setting

**Goal:** Pure backend/config changes — no UI work. Wire up session durations, disable trustDevice globally, add HIBP plugin, and register the missing `userMagicLinkEnabled` setting.

### Changes

1. **Session durations** (spec §8.3) — Better Auth's session config in `packages/backend/convex/auth.ts` does not currently set `session.expiresIn` or `session.updateAge`. Add them. Since Better Auth applies session config globally (not per-role), use the shorter admin values (4h / 30min) as the global default. The web app can override via a future `session` plugin or custom session hook — or we accept 4h for users initially and tune in a later stage. *Alternative:* use Better Auth's `databaseHooks.session.create.before` to set per-role expiry on the session record if the adapter supports it. Investigate during implementation.

2. **Disable `trustDevice` for admins** (spec §8.3) — Set `trustDevice: false` in the `twoFactor()` plugin config. This disables it globally. Spec says it "may be enabled for user accounts at the admin's discretion (future setting)" — so global disable is safe.

3. **HIBP plugin** (spec §5.3) — Install `@better-auth/haveibeenpwned` (or the correct package name per Better Auth docs). Add to plugins array in `createAuthOptions()`. This auto-checks passwords on sign-up and password reset.

4. **`userMagicLinkEnabled` setting** (spec §3.3) — Register in `appSettings.ts`:
   - Add `USER_MAGIC_LINK_ENABLED_KEY = "userMagicLinkEnabled"` to `securityPolicies.ts`
   - Add to `VALID_KEYS`, `PUBLIC_KEYS`, `DEFAULTS` (default: `false`)
   - Add validation in `validateValue()` (must be `"true"` or `"false"`)
   - Add audit action `admin.user_magic_link_policy_changed` to `POLICY_AUDIT_ACTIONS`

### Files to Modify

- [packages/backend/convex/auth.ts](packages/backend/convex/auth.ts) — session config, trustDevice, HIBP plugin
- [packages/backend/convex/appSettings.ts](packages/backend/convex/appSettings.ts) — new setting key
- [packages/backend/convex/securityPolicies.ts](packages/backend/convex/securityPolicies.ts) — new constant
- [packages/backend/convex/auditTrailConstants.ts](packages/backend/convex/auditTrailConstants.ts) — new audit action

### Verification

- `bun run typecheck` and `bun run test:convex` pass
- Dev seed login still works for admin (`admin@admin.com`) and user (`user@user.com`)
- In Convex dashboard: `appSettings.getPublic({ key: "userMagicLinkEnabled" })` returns `false`
- Sign up with a known-breached password (e.g. "Password123456789") — rejected by HIBP
- Verify `trustDevice` is disabled by checking 2FA is required every login (no 30-day skip)

**Complexity: S** | **Dependencies: None**

---

## Stage 2: Password Strength Validation with zxcvbn-ts

**Goal:** Install zxcvbn-ts, create a shared validation utility, build a `PasswordStrengthMeter` component, and integrate it into the existing web sign-up form. This prepares the foundation for the admin onboarding wizard (Stage 6).

### Changes

1. **Install dependencies** — `@zxcvbn-ts/core`, `@zxcvbn-ts/language-en`, `@zxcvbn-ts/language-common` in the `@repo/design-system` package (since the meter is a UI component).

2. **Password validation utility** — Create `packages/design-system/src/lib/password-validation.ts`. Wraps zxcvbn-ts with role-aware min-length logic from spec §5.2. Exports:
   ```ts
   validatePassword(password: string, email: string, role: "admin" | "user"): {
     valid: boolean; score: number; feedback: string; crackTime: string;
   }
   ```
   - Admin: 40-char min, score 4
   - User: 12-char min, score 4
   - Uses `zxcvbnOptions.setOptions()` with English + common dictionaries
   - Adds email/app name/role as user inputs to prevent them from appearing in passwords

3. **`PasswordStrengthMeter` component** — Create `packages/design-system/src/components/password-strength-meter.tsx`:
   - Colored bar (red → orange → yellow → green) driven by zxcvbn score
   - Green only at score 4 + length ≥ minimum
   - Shows `crackTimesDisplay.offlineSlowHashing1e4PerSecond`
   - Shows `feedback.warning` and `feedback.suggestions` inline
   - Props: `password`, `email`, `role`

4. **Integrate into web sign-up** — In `apps/web/src/components/auth/auth-form.tsx`, render the meter below the password field in sign-up mode. Update min-length from current 8 to 12. Block submit when `valid === false`.

5. **Export from design-system** — Add `PasswordStrengthMeter` and `validatePassword` to `packages/design-system/src/index.ts`.

### Files to Create

- `packages/design-system/src/lib/password-validation.ts`
- `packages/design-system/src/components/password-strength-meter.tsx`

### Files to Modify

- `packages/design-system/package.json` — add zxcvbn-ts deps
- `packages/design-system/src/index.ts` — export new component + utility
- `apps/web/src/components/auth/auth-form.tsx` — add strength meter, update min-length

### Verification

- Web sign-up form shows real-time strength meter while typing
- Passwords under 12 chars or with score < 4 prevent submission
- Meter shows crack time and feedback suggestions
- Existing sign-in flows unaffected (no meter on sign-in)
- `bun run typecheck` and `bun run test:unit` pass

**Complexity: S-M** | **Dependencies: None** (independent of Stage 1)

---

## Stage 3: Route Middleware Hardening

**Goal:** Make the server-side layout checks spec-compliant (spec §14). Add banned-user handling, cross-app role rejection, and 2FA enforcement redirects.

### Changes

1. **Admin dashboard layout** (`apps/admin/src/app/(dashboard)/layout.tsx`) — Currently checks `isAuthenticated()` and `role === "admin"`. Add:
   - `user.banned === true` → redirect to a `/forbidden` page with explanation
   - `user.twoFactorEnabled !== true` → redirect to `/enroll?reason=mfa` (the route won't exist yet; it will show a 404 which is fine — Stage 7 creates it)
   - `adminPasskeyPolicy === "required"` and user has no passkey → redirect to `/enroll?reason=passkey`
   - For now, skip `onboardingCompleted` check since the field doesn't exist yet

2. **Web dashboard layout** (`apps/web/src/app/[locale]/(dashboard)/layout.tsx`) — Add:
   - `user.role === "admin"` → redirect to `/forbidden` (admins cannot use web app)
   - `user.banned === true` → redirect to `/forbidden`
   - MFA mandatory check: if `userMfaRequired === true` and `user.twoFactorEnabled !== true` → redirect to `/setup-2fa` (placeholder route for now)

3. **Banned user check in `getAuth()`** (`packages/backend/convex/functions.ts`) — If `user.banned === true`, return `null` so all `authedQuery`/`authedMutation` calls treat banned users as unauthenticated.

4. **403 pages** — Create simple forbidden/banned pages for both apps:
   - `apps/admin/src/app/forbidden/page.tsx`
   - `apps/web/src/app/[locale]/forbidden/page.tsx`

### Files to Modify

- [apps/admin/src/app/(dashboard)/layout.tsx](apps/admin/src/app/(dashboard)/layout.tsx)
- `apps/web/src/app/[locale]/(dashboard)/layout.tsx`
- [packages/backend/convex/functions.ts](packages/backend/convex/functions.ts)

### Files to Create

- `apps/admin/src/app/forbidden/page.tsx`
- `apps/web/src/app/[locale]/forbidden/page.tsx`

### Verification

- Ban a user via Convex dashboard → they're blocked on next request
- Sign in as admin, navigate to web app URL → 403
- Sign in as user, navigate to admin app URL → already blocked (role check exists), confirm it stays working
- Normal admin and user logins still work
- `bun run ci:quick` passes

**Complexity: M** | **Dependencies: None** (independent of Stages 1-2)

---

## Stage 4: Multi-Step Login Flow with Slide Animations

**Goal:** Refactor both sign-in forms to the multi-step wizard pattern from spec §8. Add `preferredSignInMethod` tracking, horizontal slide animations, and magic link gating.

### Changes

1. **`SlideTransition` component** — Create `packages/design-system/src/components/slide-transition.tsx`:
   - Horizontal slide animation (CSS transform + opacity, ~250ms ease-out)
   - Forward: current slides left, next slides in from right
   - Back: reverse direction
   - Tracks direction from step index changes

2. **`preferredSignInMethod` tracking** — Add Convex functions:
   - Public query: looks up a user by email, returns `{ methods: string[], preferred: string }` (minimal data — no sensitive user info)
   - Mutation: updates `preferredSignInMethod` after each successful login
   - Store on user profile or as Better Auth user metadata

3. **Admin sign-in refactor** (`apps/admin/src/components/auth/admin-sign-in-form.tsx`) — Replace current single-form with 3 animated steps:
   - **Step 1 — Email:** Single email input + "Continue" button. On submit, query available methods.
   - **Step 2 — Auth method:** Password field (primary) with "Sign in with passkey" link. No magic link for admins. "Forgot password?" link. If user has passkey as preferred method, show passkey prompt primarily with "Use password instead" as alternative.
   - **Step 3 — TOTP:** 6-digit code input, "Use a backup code" toggle. Only shown when password was used + 2FA is enabled. Passkey login skips this step entirely.
   - Each step wrapped in `SlideTransition` for the horizontal animation.
   - Back button on Steps 2-3 slides back to previous step.

4. **Web sign-in refactor** (`apps/web/src/components/auth/auth-form.tsx`) — Same pattern with additional magic link option:
   - **Step 1 — Email:** Single email input + "Continue"
   - **Step 2 — Adaptive:** Shows primary method based on `preferredSignInMethod`:
     - **Passkey primary:** "Use passkey" button + "Sign in with password" / "Sign in with magic link" alternatives
     - **Password primary (or default):** Password field + "Sign in with passkey" / "Sign in with magic link" alternatives
     - **Magic link primary:** Auto-sends magic link on step load, shows "Check your inbox" + "Resend" + "Sign in with password" / "Sign in with passkey" alternatives
     - Magic link options only visible when `userMagicLinkEnabled === true` (query from Stage 1's setting)
   - **Step 3 — TOTP:** Conditional, same as admin (only for password/magic link sign-in when 2FA enabled)

5. **Magic link admin toggle** — Add a "Magic Link" toggle card to admin security settings following existing policy card patterns. This gives admins a way to enable/disable magic link for users.

### Files to Create

- `packages/design-system/src/components/slide-transition.tsx`
- `packages/backend/convex/signInMethods.ts` — public query for available methods + preferred method
- `apps/admin/src/components/settings/magic-link-policy-card.tsx` — admin toggle for `userMagicLinkEnabled`

### Files to Modify

- [apps/admin/src/components/auth/admin-sign-in-form.tsx](apps/admin/src/components/auth/admin-sign-in-form.tsx) — refactor to multi-step
- `apps/web/src/components/auth/auth-form.tsx` — refactor to multi-step, add magic link gating
- [packages/design-system/src/index.ts](packages/design-system/src/index.ts) — export SlideTransition

### Verification

- **Admin login paths:**
  - Email → Password (+ passkey link) → TOTP → dashboard
  - Email → Passkey (via link on step 2) → dashboard (no TOTP)
  - No magic link option visible in admin app
- **Web login paths:**
  - Email → Password → dashboard (no 2FA)
  - Email → Password → TOTP → dashboard (2FA enabled)
  - Email → Passkey → dashboard (no TOTP regardless of 2FA)
  - Email → Magic Link → dashboard (only when `userMagicLinkEnabled: true`, no 2FA)
  - Email → Magic Link → TOTP → dashboard (magic link + 2FA enabled)
- Slide animations play smoothly in both directions (~250ms ease-out)
- Back button on Steps 2-3 returns to previous step with reverse animation
- Preferred method remembered and shown as primary on next login
- Magic link admin toggle works in security settings
- E2E tests still pass
- `bun run ci` passes (full CI)

**Complexity: M-L** | **Dependencies: Stages 1 (`userMagicLinkEnabled` setting), 3 (middleware)**

---

## Stage 5: Manage > Onboarding Tabs

**Goal:** Add Users/Admins tab bar to the Manage > Onboarding page in the admin app.

### Changes

1. Refactor `apps/admin/src/app/(dashboard)/manage/onboarding/page.tsx` to include a tab bar: **Users** (default) and **Admins**. Use `Tabs` from `@repo/design-system`.

2. **Users tab** — shows existing waitlist/user table (already working).

3. **Admins tab** — new `AdminsDataTable` listing users with `role === "admin"`. Columns: email, name, 2FA status, passkey status, bootstrap protection. Reuse patterns from existing data tables.

4. **"Invite Admin" button** — placeholder dialog with single email field. Backend wiring comes in Stage 6.

### Files to Modify

- `apps/admin/src/app/(dashboard)/manage/onboarding/page.tsx` — add tabs

### Files to Create

- `apps/admin/src/components/onboarding/admins-data-table.tsx`
- `apps/admin/src/components/onboarding/invite-admin-dialog.tsx` (UI shell only)

### Verification

- Manage > Onboarding page shows Users and Admins tabs
- Users tab shows existing waitlist/user content
- Admins tab shows admin accounts in a table
- Invite Admin button opens a dialog (not yet wired to backend)
- `bun run ci:quick` passes

**Complexity: M** | **Dependencies: None** (can run in parallel with Stage 4)

---

## Stage 6: Admin Onboarding Wizard + Invitation Flow

**Goal:** The core new feature — admin invitation sending from the admin app, the 4-step admin onboarding wizard, and supporting backend.

### Backend Changes

1. **Admin invitation functions** — Create `packages/backend/convex/adminInvitations.ts`:
   - `sendInvitation` (admin-only mutation) — takes single email, creates token, sends invitation email pointing to `admin-app/onboarding?token=<token>`
   - `validateToken` (public query) — checks token validity, returns email
   - `claimToken` (internal mutation) — marks token as claimed
   - Reuse existing `invitationTokens` table with an added `scope` field (`"admin"` | `"user"`) or create a dedicated `adminInvitationTokens` table

2. **Audit events** — Add spec §12 events to `auditTrailConstants.ts`:
   - `admin.invitation.sent`, `admin.onboarding.account_created`, `admin.onboarding.totp_configured`
   - `admin.onboarding.backup_codes_acknowledged`, `admin.onboarding.passkey_registered`, `admin.onboarding.completed`

### Frontend Changes

3. **Onboarding route group** — `apps/admin/src/app/(onboarding)/onboarding/page.tsx` (outside the `(dashboard)` layout — no auth guard, handles partially-authenticated sessions during setup).

4. **Onboarding wizard** — `apps/admin/src/components/onboarding/admin-onboarding-wizard.tsx` with 4 sub-components:
   - **Step 1 — Create Account:** Email pre-filled from token (non-editable), password with `PasswordStrengthMeter` (40-char min), contextual explanation from spec §6.1. Calls `signUp.email()` with `emailVerified: true`.
   - **Step 2 — TOTP Setup:** Calls `twoFactor.enable({ password })` + `getTotpUri({ password })`. Shows QR code, "Show secret key" toggle, requires 6-digit verification code.
   - **Step 3 — Backup Codes:** Grid display, "Download .txt" + "Copy all" buttons. Checkbox + enter-any-two-codes verification.
   - **Step 4 — Passkey (optional):** WebAuthn registration prompt with "Skip for now". Confirmation checkbox about backup.

5. After completion → redirect to `/sign-in`. The admin must do a full sign-in.

6. **Wire invite dialog** — Connect Stage 5's placeholder `invite-admin-dialog.tsx` to `adminInvitations.sendInvitation`.

### Files to Create

- `packages/backend/convex/adminInvitations.ts`
- `apps/admin/src/app/(onboarding)/layout.tsx` (minimal layout, no dashboard chrome)
- `apps/admin/src/app/(onboarding)/onboarding/page.tsx`
- `apps/admin/src/components/onboarding/admin-onboarding-wizard.tsx`
- `apps/admin/src/components/onboarding/steps/create-account-step.tsx`
- `apps/admin/src/components/onboarding/steps/totp-setup-step.tsx`
- `apps/admin/src/components/onboarding/steps/backup-codes-step.tsx`
- `apps/admin/src/components/onboarding/steps/passkey-step.tsx`

### Files to Modify

- [packages/backend/convex/schema.ts](packages/backend/convex/schema.ts) — add `adminInvitationTokens` table (or add `scope` to `invitationTokens`)
- [packages/backend/convex/auditTrailConstants.ts](packages/backend/convex/auditTrailConstants.ts) — new actions
- `apps/admin/src/components/onboarding/invite-admin-dialog.tsx` — wire to backend
- [apps/admin/src/app/(dashboard)/layout.tsx](apps/admin/src/app/(dashboard)/layout.tsx) — redirect to `/onboarding` when admin hasn't completed setup

### Verification

- Existing admin sends invitation from Manage > Onboarding > Admins tab
- Invited person receives email with link to admin-app/onboarding
- All 4 wizard steps complete: account creation → TOTP → backup codes → passkey skip
- After completion, redirected to `/sign-in`
- New admin can sign in with password + TOTP
- Audit trail shows all onboarding events
- Existing admin and user flows unaffected
- `bun run ci:quick` passes

**Complexity: L** | **Dependencies: Stages 1 (HIBP), 2 (password meter), 3 (middleware redirect), 5 (invite dialog shell)**

---

## Stage 7: Forced Enrollment for Existing Users & Admins

**Goal:** When 2FA or passkey policies become mandatory, existing users/admins who haven't enrolled are hard-blocked from dashboard access and forced through a dedicated enrollment flow. This closes the gap between the bypassable post-sign-in redirects (to `/settings?enforce=...`) and the new-admin onboarding wizard (which requires an invitation token and is for first-time account creation).

### Problem

Currently, when an admin makes 2FA or passkeys mandatory, the enforcement has gaps:

- **Post-sign-in redirect** (`enforcePostSignInPolicies`) sends users to `/settings?tab=security&enforce=mfa|passkey` — but they can navigate away from the settings page.
- **Web app `AuthGuard`** runs a `useEffect` that re-checks policies — but this is client-side and doesn't prevent server-rendered dashboard content from loading.
- **Admin app has no real-time dashboard guard** beyond the sign-in check.
- **The settings page is generic** — not a guided enrollment experience. Users must figure out 2FA/passkey setup themselves from the security tab.
- **Stage 6's onboarding wizard** (`/onboarding`) requires an invitation token and creates a new account — it doesn't apply to existing users who already have accounts.

### Changes

1. **`/enroll` route (admin app)** — Create `apps/admin/src/app/(enroll)/enroll/page.tsx`:
   - Outside the `(dashboard)` layout — uses its own minimal layout (similar to `(onboarding)`)
   - Requires authentication (redirect to `/sign-in` if not logged in)
   - Reads the `reason` query param (`mfa`, `passkey`, or both) to determine which steps to show
   - Renders focused enrollment steps, reusing components from Stage 6's onboarding wizard:
     - **2FA enrollment:** TOTP setup step + backup codes step (from `totp-setup-step.tsx` and `backup-codes-step.tsx`)
     - **Passkey enrollment:** Passkey registration step (from `passkey-step.tsx`) — **no "Skip for now"** when policy is `"required"`
   - If both 2FA and passkey are required, shows them sequentially
   - On completion → redirect to `/` (dashboard)
   - Audit events: `admin.enrollment.totp_configured`, `admin.enrollment.passkey_registered`

2. **`/enroll` route (web app)** — Create `apps/web/src/app/[locale]/(enroll)/enroll/page.tsx`:
   - Same pattern as admin, but checks user-scoped policies (`userMfaRequired`, `userPasskeyPolicy`)
   - Reuses shared TOTP/passkey setup components
   - On completion → redirect to `/dashboard`

3. **Hard-block in admin dashboard layout** — Update the Stage 3 TODO in `apps/admin/src/app/(dashboard)/layout.tsx`:
   - Replace the commented-out `/onboarding` redirect with `/enroll` checks
   - Server-side queries for both policies and user state:
     - `adminMfaRequired === true` and `user.twoFactorEnabled !== true` → `redirect("/enroll?reason=mfa")`
     - `adminPasskeyPolicy === "required"` and user has no passkey → `redirect("/enroll?reason=passkey")`
   - Requires a new Convex query to check if a user has registered passkeys (e.g. `api.auth.userHasPasskey`)
   - **Server-side check** — cannot be bypassed by client-side navigation

4. **Hard-block in web dashboard layout** — Update `apps/web/src/app/[locale]/(dashboard)/layout.tsx`:
   - Same server-side checks for user policies (`userMfaRequired`, `userPasskeyPolicy`)
   - Redirect to `/enroll?reason=mfa|passkey`

5. **Update post-sign-in redirects** — Change both apps' `enforcePostSignInPolicies` to redirect to `/enroll` instead of `/settings?enforce=...`:
   - Admin `enforcePostSignInPolicies` in `admin-sign-in-form.tsx`
   - Web `enforcePostSignInPolicies` in `auth-form.tsx`
   - Web `AuthGuard` `useEffect` in `auth-guard.tsx`

6. **Remove enforcement banner from settings** — The `enforce` query param handling in settings pages becomes unnecessary. Clean up the banner logic in `admin-security-section.tsx` and `security-section.tsx`.

### Files to Create

- `apps/admin/src/app/(enroll)/layout.tsx` — minimal authenticated layout (no dashboard chrome)
- `apps/admin/src/app/(enroll)/enroll/page.tsx`
- `apps/admin/src/components/enroll/enrollment-wizard.tsx` — orchestrates required enrollment steps
- `apps/web/src/app/[locale]/(enroll)/layout.tsx`
- `apps/web/src/app/[locale]/(enroll)/enroll/page.tsx`
- `apps/web/src/components/enroll/enrollment-wizard.tsx`

### Files to Modify

- `apps/admin/src/app/(dashboard)/layout.tsx` — replace Stage 3 TODO with hard-block redirect to `/enroll`
- `apps/web/src/app/[locale]/(dashboard)/layout.tsx` — add hard-block redirect to `/enroll`
- `apps/admin/src/components/auth/admin-sign-in-form.tsx` — redirect to `/enroll` instead of `/settings?enforce=...`
- `apps/web/src/components/auth/auth-form.tsx` — same
- `apps/web/src/components/auth/auth-guard.tsx` — redirect to `/enroll` instead of `/settings?enforce=...`
- `apps/admin/src/components/settings/admin-security-section.tsx` — remove `enforce` query param banner
- `apps/web/src/components/settings/security-section.tsx` — remove `enforce` query param banner
- `packages/backend/convex/auditTrailConstants.ts` — enrollment audit events

### Verification

- Enable mandatory 2FA for admins → existing admin without 2FA is blocked from dashboard, redirected to `/enroll`
- Admin cannot navigate to any dashboard route — server-side layout blocks it
- Admin completes 2FA enrollment on `/enroll` → gains dashboard access
- Enable required passkeys for admins → existing admin without passkey is redirected to `/enroll`
- Passkey enrollment step has **no skip option** (unlike the optional passkey in Stage 6 onboarding)
- Same flow works for web app users when `userMfaRequired` or `userPasskeyPolicy` becomes `"required"`
- If both 2FA and passkey are required, enrollment wizard shows all required steps sequentially
- Already-enrolled users/admins pass through to dashboard without redirect
- Post-sign-in flow also redirects to `/enroll` (no longer goes to `/settings`)
- `bun run ci:quick` passes

**Complexity: M** | **Dependencies: Stage 6** (reuses onboarding wizard step components)

---

## Stage 8: Recovery Flows + Emergency Reset

**Goal:** Backup code usage prompts, email bypass recovery for admins, emergency reset script, and user recovery parallels.

### Changes

1. **Backup code usage banner** (spec §11.1) — After a backup-code-based sign-in, detect it (the sign-in form already handles `twoFactor.verifyBackupCode`) and show a persistent dashboard banner:
   > "You used a backup code. Set up TOTP on a new device now."
   - "Set up now" → navigate to security settings
   - "Remind me in 1 hour" → max 3 snoozes (tracked in localStorage), then blocks dashboard access
   - Audit event: `admin.recovery.backup_code_used`

2. **Email bypass recovery** (spec §11.2) — Create `apps/admin/src/app/(auth)/recovery/page.tsx`:
   - Admin enters email → system sends recovery email
   - Clicking link authenticates with email only
   - Before dashboard access, forced through TOTP re-setup (reuse Step 2 + Step 3 from onboarding wizard)
   - Old TOTP secret invalidated
   - Audit event: `admin.recovery.email_bypass_used` with IP

3. **Emergency reset script** (spec §11.4) — Create `packages/backend/convex/emergencyReset.ts`:
   - `internalMutation` that takes an admin email, clears `twoFactorEnabled`, resets onboarding state
   - Documented with usage instructions and audit event `admin.emergency_reset.executed`
   - Runnable via `bunx convex run emergencyReset:execute`

4. **User recovery** — Same backup-code banner pattern in web app's `AuthGuard`

### Files to Create

- `packages/backend/convex/emergencyReset.ts`
- `apps/admin/src/app/(auth)/recovery/page.tsx`
- `apps/admin/src/components/auth/backup-code-banner.tsx`
- `apps/web/src/components/auth/backup-code-banner.tsx`

### Files to Modify

- `apps/admin/src/components/auth/auth-guard.tsx` — detect backup-code login, render banner
- `apps/web/src/components/auth/auth-guard.tsx` — same
- `packages/backend/convex/auditTrailConstants.ts` — recovery audit events

### Verification

- Sign in with backup code → banner appears with re-setup prompt
- Snooze 3 times → dashboard access blocked until TOTP is re-set up
- Email bypass recovery works end-to-end for admin
- `bunx convex run emergencyReset:execute { "email": "admin@admin.com" }` clears 2FA
- All recovery audit events recorded
- Normal login flows unaffected
- `bun run ci:quick` passes

**Complexity: M** | **Dependencies: Stages 6, 7** (onboarding wizard for TOTP re-setup, enrollment route for forced re-enrollment)

---

## Summary

| Stage | Description | Size | Depends On |
|-------|-------------|------|------------|
| 1 | Session config, trustDevice, HIBP, `userMagicLinkEnabled` | S | — |
| 2 | zxcvbn-ts password validation + strength meter | S-M | — |
| 3 | Route middleware hardening (banned, role, 2FA) | M | — |
| 4 | Multi-step login flow with slide animations + magic link gating | M-L | Stages 1, 3 |
| 5 | Manage > Onboarding tabs (Users + Admins) | M | — |
| 6 | Admin invitation + onboarding wizard (4 steps) | L | Stages 1, 2, 3, 5 |
| 7 | Forced enrollment for existing users & admins | M | Stage 6 |
| 8 | Recovery flows + emergency reset script | M | Stages 6, 7 |

**Stages 1, 2, 3, and 5 can be worked in parallel** — they have no interdependencies.
