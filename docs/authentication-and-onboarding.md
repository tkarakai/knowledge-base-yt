# Authentication & Onboarding Specification

This spec covers authentication, onboarding, and recovery for both **admin** and **regular user** accounts. Admins and users share the same underlying Better Auth infrastructure but have different security requirements, onboarding paths, and app boundaries.

---

## 1. Design Principles

**1. Email is identity, not a security factor.**
Email identifies the account. Using email OTP or magic link as a *second* factor doesn't add a second security dimension — it's still one thing: control of that inbox. Email paths are recovery tools, not authentication factors.

**2. Password is universal infrastructure.**
Every account (admin and user) is created with email+password credentials. For admins this is a hard technical requirement — Better Auth's `twoFactor` plugin requires it (`twoFactor.enable({ password })` and `getTotpUri({ password })`). For users it provides a consistent baseline. The password may live dormant in a password manager and never be typed after setup if the user prefers passkey or magic link — but it must exist.

**3. App boundaries are strict.**
Admin accounts access the admin app only. User accounts access the web app only. There is no cross-app login. Invitations, sign-in pages, and session middleware all enforce this boundary.

**4. Security scales with privilege.**
Admins get mandatory 2FA, 40-character passwords, and shorter sessions. Users get the same options available to them but with relaxed defaults — shorter password minimums, optional 2FA, optional passkey — all tunable by admins via security policy settings.


## 2. Account Types and App Boundaries

| Property | Admin | User |
|---|---|---|
| App | Admin app (port 3002) | Web app (port 3001) |
| Sign-in URL | `admin-app/sign-in` | `web-app/sign-in` |
| Onboarding path | `admin-app/onboarding` (dedicated wizard) | `web-app/sign-up` (signup flow *is* onboarding) |
| How account is created | Bootstrap or admin invitation only | Self-signup (if enabled) or user invitation |
| Password required | Yes (40 char min, score 4) | Yes (15 char min, score 4) |
| 2FA (TOTP) | Mandatory — cannot access dashboard without it | Admin-configurable: optional or mandatory |
| Passkey | Optional (recommended) | Optional (if enabled by admin) |
| Magic link sign-in | Not available | Admin-configurable: enabled or disabled |
| Can access the other app | No | No |

**Enforcement:** The admin app's middleware rejects sessions where `user.role !== "admin"`. The web app's middleware rejects sessions where `user.role === "admin"`. This is not a UI-only restriction — it is enforced at the session/middleware level.


## 3. Authentication Architecture

### 3.1 Account Foundation (all accounts)

Every account — admin or user — is created as an email+password credential account in Better Auth. This is driven by:

- **Technical requirement for admins:** `twoFactor.enable({ password })` and `getTotpUri({ password })` require a credential account. Without one, TOTP cannot be enabled at all.
- **Consistency for users:** Users also start with email+password. If the admin later enables magic link or the user adds a passkey, those are layered on top of the existing credential account.

### 3.2 Sign-in Methods by Account Type

#### Admin sign-in methods

| Method | TOTP required at login? | Notes |
|---|---|---|
| **Password** | **Yes** | Password alone is single-factor; TOTP covers phishing/keylogging |
| **Passkey** | **No** | Passkey is inherently two-factor (possession + biometric/PIN) |

No magic link option for admins.

#### User sign-in methods

| Method | TOTP required at login? | Notes |
|---|---|---|
| **Password** | **If 2FA is enabled for the user** | Depends on admin policy + user choice |
| **Magic link** | **If 2FA is enabled for the user** | Only available if admin has enabled magic link |
| **Passkey** | **No** | Passkey is inherently two-factor; TOTP is never required on top |

**Why no TOTP with passkey login (for either account type):** A passkey inherently provides two authentication factors — possession of the device/key and biometric verification or device PIN. Requiring TOTP on top of a passkey adds friction without meaningful security benefit. TOTP remains relevant for password and magic link logins, where the sign-in method is single-factor.

### 3.3 Admin-Controlled Security Policies for Users

Admins configure these from the admin app's security settings. All policies are stored in the `appSettings` table and read at request time.

| Setting | Key | Options | Default |
|---|---|---|---|
| Magic link sign-in | `userMagicLinkEnabled` | enabled / disabled | disabled |
| 2FA requirement | `userMfaRequired` | optional / mandatory | optional |
| Passkey | `userPasskeyPolicy` | disabled / optional | optional |

**How 2FA interacts with sign-in methods for users:**

- **`userMfaRequired: "optional"`** — Users may enable 2FA from their security settings. If they do, TOTP is required at password and magic link login. Passkey login never requires TOTP.
- **`userMfaRequired: "mandatory"`** — All users must enable 2FA. Users who haven't are redirected to a 2FA setup flow before accessing the app. TOTP is required at password and magic link login. Passkey login still does not require TOTP.

When a user enables 2FA (voluntarily or because it's mandatory), the same Better Auth `twoFactor.enable({ password })` flow applies — they enter their password to unlock TOTP setup.


## 4. Factor Portability (important context)

### TOTP is not device-specific

TOTP is based on a shared secret string (the seed). The QR code shown during setup *is* that secret, just encoded visually. The user can:

- **Scan the QR code on multiple devices simultaneously** during setup — every device gets the same secret and generates identical codes.
- **Save the secret string** (shown via a "Show secret key" button alongside the QR code) and enter it into any TOTP app at any point in the future.

A single TOTP setup can effectively be available on every device the user owns, if they handle the secret thoughtfully.

### Passkeys are increasingly portable

- **Apple iCloud Keychain** syncs passkeys across all Apple devices signed into the same Apple ID.
- **Google Password Manager** syncs passkeys across Android devices and Chrome on any platform.
- **1Password, Bitwarden, Dashlane** provide cross-platform passkey storage, including Windows.
- **NIST SP 800-63-4** (finalized July 2025) officially recognizes synced passkeys as meeting AAL2 compliance.
- **Passkey portability** (exporting between managers) is supported in iOS 26/macOS 26 Tahoe and being adopted by third-party managers.

A device-bound passkey (e.g., Windows Hello without a third-party manager) is the limiting case both apps need to warn about.


## 5. Password Policy

Both admins and users must have passwords. The policies differ by account type:

| Rule | Admin | User |
|---|---|---|
| Minimum length | 40 characters | 15 characters |
| zxcvbn-ts score | 4 (maximum) | 4 (maximum) |
| Breached password check (HIBP) | Yes | Yes |
| Complexity requirements (uppercase, symbols, etc.) | None — per NIST SP 800-63B-4 | None |

### 5.1 Why These Thresholds

**Admin (40 chars):** No human can memorize a truly random 40-character string. This is intentional — it functionally requires a password manager, which means unique, high-entropy, backed-up passwords. At 40 characters even lowercase-only gives 188 bits of entropy, far beyond the crackable threshold.

**User (15 chars):** A more practical minimum that allows strong passphrases while still filtering out weak passwords. The score-4 requirement from zxcvbn-ts ensures the password resists dictionary attacks, pattern detection, and known-password matching regardless of length.

**Both:** NIST SP 800-63B-4 explicitly removes mandatory complexity requirements. Length and genuine unpredictability matter; character class requirements produce predictable patterns.

### 5.2 Entropy Check via zxcvbn-ts

Use [`@zxcvbn-ts/core`](https://zxcvbn-ts.github.io/zxcvbn/) — a modern, tree-shakable TypeScript rewrite of Dropbox's original zxcvbn. It performs dictionary matching, pattern detection, keyboard walk analysis, and known-password detection. Require score **4** for both admins and users.

```typescript
// Install: bun add @zxcvbn-ts/core @zxcvbn-ts/language-en @zxcvbn-ts/language-common
import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import * as zxcvbnEnPackage from "@zxcvbn-ts/language-en";

zxcvbnOptions.setOptions({
  translations: zxcvbnEnPackage.translations,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
  },
});

function validatePassword(
  password: string,
  email: string,
  appName: string,
  role: "admin" | "user"
): { valid: boolean; feedback: string } {
  const minLength = role === "admin" ? 40 : 15;

  if (password.length < minLength) {
    return {
      valid: false,
      feedback: `Password must be at least ${minLength} characters.${
        role === "admin"
          ? " Use a randomly generated password from your password manager."
          : ""
      }`,
    };
  }

  const result = zxcvbn(password, [email, appName, role, "password"]);

  if (result.score < 4) {
    const suggestions = result.feedback.suggestions.join(" ");
    const warning = result.feedback.warning;
    return {
      valid: false,
      feedback: warning
        ? `${warning}. ${suggestions}`
        : suggestions || "Password is too predictable. Try a longer or more random password.",
    };
  }

  return { valid: true, feedback: "" };
}
```

### 5.3 Breached Password Check

Use Better Auth's [`haveibeenpwned` plugin](https://www.better-auth.com/docs/plugins/have-i-been-pwned) for both admins and users. The plugin uses k-anonymity (only the first 5 chars of the SHA-1 hash are sent).

### 5.4 UI

A live strength meter driven by zxcvbn-ts during typing. Show the estimated crack time from `result.crackTimesDisplay.offlineSlowHashing1e4PerSecond`. The meter turns green only at score 4 with length ≥ minimum. Show `feedback.warning` and `feedback.suggestions` inline.


## 6. Admin Onboarding Flow

### 6.0 Entry Points

There are exactly two ways to begin admin onboarding:

1. **Bootstrap** — the very first admin, created via the bootstrap process when no admins exist.
2. **Admin invitation** — an existing admin sends an invitation email to a single email address from the admin app.

There is no self-signup for admin accounts. The admin app's sign-up page does not exist — only the onboarding flow, which requires either a bootstrap token or a valid invitation link.

**Email verification is handled by the entry point itself.** When an admin clicks an invitation link, their email is verified by the act of clicking the link. The auth hook in `auth.ts` (`user.create.before`) sets `emailVerified: true` on accounts whose email is in the `adminEmails` table. The bootstrap process similarly establishes the email as verified. There is no separate "verify your email" step in the admin onboarding wizard.

### 6.0.1 Token Claiming & Onboarding Progress Tracking

**Token is claimed after Step 0 (account creation), not at the end of the wizard.** Once the admin's Better Auth account exists, the invitation token is marked `"claimed"` and cannot be reused to create another account. This is the critical security boundary — one token, one account.

**Onboarding progress is tracked server-side** via the `adminInvitations` table:
- `status`: `"invited"` → `"claimed"` → `"completed"`
- `onboardingStep: v.optional(v.number())` — which wizard step to resume from (1=TOTP, 2=backup codes, 3=passkey)

**Dashboard enforcement checks the invitation status, NOT `twoFactorEnabled`.** This ensures ALL onboarding steps are enforced — including backup code acknowledgment and the passkey decision — not just 2FA setup. The `twoFactorEnabled` check for existing admins without invitation records is handled separately in Stage 7 (forced enrollment).

**Seed admins** (`createForSeed`) are created with `status: "completed"` so dev seed admins bypass onboarding and can access the dashboard immediately.

#### Invitation Lifecycle

```
"invited"    → token sent, waiting for signup
"claimed"    → account created, onboarding in progress (onboardingStep tracks position)
"completed"  → all 4 steps done, full dashboard access
```

### 6.0.2 Abandonment & Resume

Admins who abandon the onboarding wizard at any point can resume later. The multi-step sign-in form already adapts to what the admin has set up (password only vs password+TOTP), so no changes are needed to the sign-in flow. The dashboard layout redirects incomplete admins to `/onboarding`, where the wizard queries the saved `onboardingStep` and resumes from there.

| Case | When abandoned | Invitation status | Auth state | How they return | Wizard resumes at |
|------|---------------|-------------------|------------|----------------|-------------------|
| A | Never opened link | `invited` | No account | Open invitation link | Step 0 (Create Account) |
| B | Opened link, closed before creating account | `invited` | No account | Open invitation link | Step 0 |
| C | Created account (Step 0 done) | `claimed`, step=1 | Password, no 2FA | Sign in: Email → Password | Step 1 (TOTP) — shows password prompt |
| D | Started TOTP, closed before verifying code | `claimed`, step=1 | Password, 2FA secret unverified | Sign in: Email → Password | Step 1 — calls `enable()` again with new secret |
| E | Verified TOTP (Step 1 done) | `claimed`, step=2 | Password + 2FA | Sign in: Email → Password → TOTP | Step 2 (Backup Codes) — re-fetches codes from server |
| F | Saved backup codes (Step 2 done) | `claimed`, step=3 | Password + 2FA | Sign in: Email → Password → TOTP | Step 3 (Passkey) |
| G | Completed all steps | `completed` | Full setup | Sign in normally | No redirect — full dashboard access |
| H | No invitation record (e.g. bootstrap admin) | None | Varies | Sign in normally | No redirect (Stage 7 handles forced enrollment) |

### 6.0.3 Wizard Entry Modes

The onboarding wizard has two entry modes:

1. **Fresh start** (token in URL, unauthenticated): validate token → start at Step 0 → claim token after account creation → continue through remaining steps
2. **Resume** (no token, authenticated, redirected from dashboard): query `getMyOnboardingStatus` → start at saved `onboardingStep`

If the user is already authenticated AND has a token in the URL, the wizard ignores the token (it's already claimed) and queries the invitation record to determine the resume step.

### 6.1 Step 0 — Create Account (email + password)

The admin's email is pre-filled and non-editable (from the invitation token validation). They enter their name and create their password.

Display a password input with a live strength meter (zxcvbn-ts). See §5 for enforcement details.

On submit:
1. Better Auth's `signUp.email()` creates the credential account. The auth hook sets `emailVerified: true` and `role: "admin"` for emails in the `adminEmails` table (which was populated when the invitation was sent).
2. The invitation token is claimed via `claimInvitation({ token })`, setting status to `"claimed"` and `onboardingStep: 1`.
3. The password is kept in a React ref (in-memory only, never persisted) so Step 1 can auto-enable TOTP without re-prompting.

### 6.2 Step 1 — TOTP Setup

This step has two modes depending on whether the password is available in memory:

**Fresh flow** (password available from Step 0): Automatically calls `twoFactor.enable({ password })` on mount — no password prompt needed. This is the seamless experience for admins completing onboarding in one session.

**Resume flow** (password not in memory — admin abandoned and returned later): Shows a password prompt first. The admin enters their password (from their password manager), then TOTP is enabled.

After enabling:
1. Display the TOTP QR code (generated via `QRCode.toDataURL()` from the `qrcode` library)
2. Show a collapsible "Manual setup key" with the raw secret extracted from the TOTP URI, plus a copy button
3. The admin enters a valid 6-digit code from their authenticator app
4. `twoFactor.verifyTotp({ code })` validates and returns `{ backupCodes }` — these are passed to Step 2

Only after successful code verification does `twoFactorEnabled` get set to `true`. Write audit event: `admin.onboarding.totp_configured`.

### 6.3 Step 2 — Backup Codes

Better Auth generates backup codes when 2FA is verified. This step requires the admin to actually engage with them.

This step has two modes:

**Fresh flow** (backup codes available from Step 1's `verifyTotp` response): Shows codes directly.

**Resume flow** (no codes in memory — admin abandoned after TOTP setup): Fetches codes from `{CONVEX_SITE_URL}/api/two-factor/backup-codes` with `credentials: "include"`.

Then:
1. Display codes in a grid with **"Download .txt"** and **"Copy all"** buttons
2. Checkbox: *"I have saved my backup codes in a secure place"*
3. After checkbox: two input fields to enter any two of the backup codes for verification (must be distinct, must match actual codes)

Write audit event: `admin.onboarding.backup_codes_acknowledged`.

### 6.4 Step 3 — Passkey Registration (optional)

Present passkey registration with an optional name/label input:
- **"Add passkey"** button → calls `authClient.passkey.addPasskey({ name? })`
- On success: confirmation message + **"Complete setup"** button
- **"Skip for now"** link for admins who don't want a passkey yet

Write audit event: `admin.onboarding.passkey_registered` (if added) or `admin.onboarding.passkey_skipped` (if skipped), then `admin.onboarding.completed`.

Then: call `completeOnboarding()` (sets invitation status to `"completed"`, clears `onboardingStep`), sign out, redirect to `/sign-in`. The admin must complete a full proper login.

> **Why redirect to sign-in?** The onboarding session was scoped to onboarding routes. The first real admin session should go through the full normal auth flow, proving end-to-end that authentication is working.


## 7. User Sign-Up Flow (web app)

For users, sign-up *is* onboarding. The flow is simpler than admin onboarding because 2FA and passkey are optional.

### 7.1 Step 1 — Create Account (email + password)

User enters their email and creates a password (15 char min, score 4). See §5 for enforcement.

On submit, Better Auth's `signUp.email()` creates the credential account and sends a verification email (if email verification is enabled by admin policy).

### 7.2 Step 2 — Verify Email (if required by admin policy)

If `userEmailVerificationRequired` is `true` (the default), the user must click the verification link before accessing the app. If disabled by admin, this step is skipped.

### 7.3 Optional: Magic Link Setup

If the admin has enabled magic link (`userMagicLinkEnabled: true`), the user can choose to sign in via magic link on subsequent logins. No additional setup is required — magic link uses the verified email.

### 7.4 Optional: 2FA Setup

Depends on the admin's `userMfaRequired` setting:

- **`optional`** (default): The user can enable 2FA from their security settings at any time. The flow is the same as admin TOTP setup (§6.2–6.3) — enter password to unlock, scan QR, verify code, save backup codes.
- **`mandatory`**: The user is redirected to 2FA setup after sign-up (or on next login if they haven't set it up yet) and cannot access the app until complete. Same flow as admin TOTP setup.

In both cases, TOTP is required at login only for password and magic link sign-ins. Passkey sign-in never requires TOTP.

### 7.5 Optional: Passkey Registration

If the admin has passkeys enabled (`userPasskeyPolicy: "optional"`), the user can add a passkey from their security settings at any time. Same WebAuthn flow as admin passkey registration.


## 8. Login Flow (Multi-Step, Both Apps)

The login flow is a multi-step wizard. Each step is a distinct screen. Transitions between steps use a **horizontal slide animation** (next step slides in from the right, previous step slides out to the left; going back reverses the direction).

### 8.1 Step 1 — Email

Both apps start the same way: a single email input field.

```
┌──────────────────────────────────────────────────────┐
│  Sign in                                             │
│                                                      │
│  Email address                                       │
│  [_______________________________]                   │
│                                                      │
│  [Continue →]                                        │
└──────────────────────────────────────────────────────┘
```

On submit, the server looks up the account and determines what sign-in methods are available for this user. The response drives which step comes next.

### 8.2 Step 2 — Authentication Method (adaptive)

The next screen depends on what the account has configured. The server returns the user's available methods and their primary (preferred) method. The UI presents the primary method prominently, with alternatives as secondary links.

#### If passkey is the primary method:

```
┌──────────────────────────────────────────────────────┐
│  ← Back                                              │
│                                                      │
│  Sign in with passkey                                │
│                                                      │
│  [Use passkey]  ← triggers WebAuthn prompt           │
│                                                      │
│  Or: Sign in with password                           │
└──────────────────────────────────────────────────────┘
```

If the user clicks "Sign in with password", slide to the password step.

#### If password is the primary method (or only method):

```
┌──────────────────────────────────────────────────────┐
│  ← Back                                              │
│                                                      │
│  Enter your password                                 │
│                                                      │
│  [_______________________________]                   │
│                                                      │
│  [Sign in →]                                         │
│                                                      │
│  Or: Sign in with passkey  (if passkey is available) │
│  Or: Sign in with magic link  (if enabled, web only) │
│  Forgot password?                                    │
└──────────────────────────────────────────────────────┘
```

#### If magic link is the primary method (web app only, if enabled by admin):

```
┌──────────────────────────────────────────────────────┐
│  ← Back                                              │
│                                                      │
│  We sent a sign-in link to your email                │
│  Check your inbox and click the link to continue.    │
│                                                      │
│  Didn't receive it? [Resend]                         │
│                                                      │
│  Or: Sign in with password                           │
│  Or: Sign in with passkey  (if passkey is available) │
└──────────────────────────────────────────────────────┘
```

The magic link is sent automatically when this step loads — no extra button click needed.

**How "primary method" is determined:** The user's most recently used sign-in method, stored on their account record. Defaults to password for new accounts, passkey if a passkey has been registered, or magic link if the user last signed in that way. This is a UX preference, not a security gate — the user can always switch to any available method via the alternative links.

### 8.3 Step 3 — TOTP Verification (conditional)

This step appears only when:
- The user has 2FA enabled, **and**
- They signed in via password or magic link (not passkey)

Passkey sign-in skips this step entirely and goes straight to the authenticated redirect.

```
┌──────────────────────────────────────────────────────┐
│  ← Back                                              │
│                                                      │
│  Two-factor authentication                           │
│                                                      │
│  Enter the 6-digit code from your authenticator app  │
│                                                      │
│  [______]                                            │
│                                                      │
│  [Verify →]                                          │
│                                                      │
│  Lost your device? [Use a backup code]               │
└──────────────────────────────────────────────────────┘
```

If "Use a backup code" is clicked, the input switches to a backup code field.

### 8.4 Flow Summary by Account Type

#### Admin login paths:

```
Email → Passkey → ✓ Dashboard          (no TOTP — passkey is 2FA)
Email → Password → TOTP → ✓ Dashboard  (TOTP always required)
```

Admins never see magic link as an option.

#### User login paths:

```
Email → Passkey → ✓ App                         (no TOTP — passkey is 2FA)
Email → Password → ✓ App                        (no 2FA enabled)
Email → Password → TOTP → ✓ App                 (2FA enabled)
Email → Magic Link → ✓ App                      (no 2FA enabled, magic link enabled)
Email → Magic Link → TOTP → ✓ App               (2FA enabled, magic link enabled)
```

### 8.5 Animation Details

The multi-step flow uses horizontal slide transitions:
- **Forward:** Current step slides out to the left, next step slides in from the right
- **Back:** Current step slides out to the right, previous step slides in from the left
- Duration: ~250ms with an ease-out curve
- During transition, both steps are visible briefly (overlap/crossfade is acceptable)
- The "Back" link on steps 2+ returns to the previous step with the reverse animation

### 8.3 Session Properties

```typescript
adminSession: {
  expiresIn: 60 * 60 * 4,        // 4 hours
  updateAge: 60 * 30,             // Refresh if active within last 30 min
}

userSession: {
  expiresIn: 60 * 60 * 24 * 7,   // 7 days
  updateAge: 60 * 60,             // Refresh if active within last 1 hour
}
```

`trustDevice` (Better Auth's 2FA skip for 30 days) should be **disabled for admin accounts**. It may be enabled for user accounts at the admin's discretion (future setting).


## 9. Admin Invitation Flow

### 9.1 Sending Invitations

From the admin app's **Manage > Onboarding** page (Admins tab), an admin clicks "Invite Admin". This opens a form with a **single email address field** (not multi-email like user invitations).

The `invite` mutation:
1. Validates the email and checks for existing invitations (rejects if already claimed/completed, allows re-invite if expired)
2. Creates or updates the `adminInvitations` row with `status: "invited"`
3. Ensures the email is in the `adminEmails` table (so the auth hook auto-promotes them to admin role on signup)
4. Writes audit event: `admin.invitation.sent` with `meta: { inviteeEmail }`
5. Schedules an `internalAction` (`adminInvitationActions.generateTokenAndSendEmail`) which:
   - Generates a 32-byte crypto-random token (64 hex chars)
   - Stores the token + expiry (default 7 days, configurable via `invitationTokenExpiryDays` in `appSettings`) on the invitation row
   - Builds onboarding URL: `{ADMIN_SITE_URL}/onboarding?token={token}` (env var, default `http://localhost:3002`)
   - Sends an HTML email via Resend (or logs the URL to console in dev when no `RESEND_API_KEY` is set)

### 9.2 Accepting an Admin Invitation

When the invited person clicks the link:
1. The onboarding wizard validates the token via `validateToken` query (checks: exists, not already claimed/completed, not expired)
2. Email is extracted from the token validation response and pre-filled in the account creation form
3. The admin onboarding wizard starts at Step 0 (§6.1) with the email pre-filled and non-editable
4. After account creation, the token is claimed (§6.0.1) and the full onboarding flow continues

### 9.3 Auth Hook: Admin Signup Bypass

The auth hook (`user.create.before` in `auth.ts`) checks both `hasValidInvitation` (waitlist) AND `hasValidAdminInvitation` before blocking signups in non-signup onboarding modes. This ensures admin invitees can create accounts even when public signup is disabled (invite-only or waitlist mode). The hook also sets `emailVerified: true` for admin accounts.

### 9.4 User Invitations (comparison)

User invitations are sent from **Manage > Onboarding** (Users tab) and allow **multiple email addresses**. The invitation link points to `web-app/sign-up?token=<invitation-token>` and is only valid for the web app. User invitations follow the user sign-up flow (§7).


## 10. Admin App — Manage Section

The existing **Manage > Onboarding** page gains a tab bar to split between Users and Admins. This is not two separate sidebar entries — it is one page with two tabs. The existing users table is reused, just filtered by role.

### Manage > Onboarding — Users tab

The default tab. Shows a table of all user accounts (where `role !== "admin"`). This is the existing users table, filtered to exclude admins. Provides:
- Search and filter
- View user details, status, last login
- Ban/unban users
- **"Invite Users"** button — multi-email input
- View user's 2FA status, passkey status

### Manage > Onboarding — Admins tab

Shows a table of all admin accounts (where `role === "admin"`). Same table component as the Users tab, filtered for admins. Provides:
- View admin details, status, last login, onboarding completion status
- Ban/unban admins (with protection: admins in the `adminEmails` bootstrap table cannot be banned)
- **"Invite Admin"** button — single email address input
- View admin's 2FA status, passkey status, backup code usage


## 11. Recovery Scenarios

### 11.1 Admin Recovery

#### Lost TOTP device, backup codes available

1. Admin clicks "Use a backup code" on the TOTP prompt (password login only)
2. Enters one of their backup codes
3. Better Auth validates and marks the code as used
4. Full session issued
5. Dashboard shows immediate prompt: **"You used a backup code. Set up TOTP on a new device now."** Cannot be dismissed without completing new TOTP setup or clicking "Remind me in 1 hour" (max 3 snoozes before it blocks access)
6. Write audit event: `admin.recovery.backup_code_used`

#### Lost TOTP device, no backup codes, email still accessible

1. Admin visits the recovery flow
2. Enters their admin email
3. System sends a recovery email
4. Admin clicks link → authenticated with email only
5. **Before any dashboard access**, forced through mandatory re-setup:
   - Re-enter password to unlock TOTP setup
   - New TOTP setup (same as §6.2)
   - New backup codes generated and acknowledged (same as §6.3)
6. Old TOTP secret invalidated
7. Write audit event: `admin.recovery.email_bypass_used` with timestamp and IP
8. Admin notified via email that a recovery was performed from [IP address]

This path is deliberately conspicuous — a break-glass action, not a convenient shortcut.

#### Email compromised, password + TOTP still available

1. Admin signs in with email + password + TOTP (no email access needed)
2. Another admin creates a replacement admin account with a new email
3. Original account disabled: `isBanned: true`, `bannedReason: "Email compromised — replaced by [new email]"`
4. Original record retained for audit trail integrity
5. Write audit events: `admin.account.disabled`, `admin.account.created`

#### Total lockout

Last resort requiring direct database access:
1. Convex internal mutation clears `twoFactorEnabled` and resets onboarding state
2. Admin re-authenticates via email recovery → forced through TOTP re-setup
3. Write audit event: `admin.emergency_reset.executed` with `meta: { initiatedVia: "direct_db_script" }`

Script documented in repo, runnable via `bunx convex run`.

### 11.2 User Recovery

#### Lost TOTP device (if 2FA was enabled)

Same as admin flow — backup codes, then email recovery with forced TOTP re-setup. The flows are identical, just scoped to the web app.

#### Forgot password

Standard Better Auth password reset flow via email link. If the user has 2FA enabled, the reset flow requires TOTP verification before allowing a new password.

#### Account issues

Users contact support or an admin. Admins can ban/unban users, trigger password resets, or clear 2FA state from the admin app.


## 12. Audit Trail Integration

All onboarding, login, and recovery events are recorded in the `auditTrail` table using `scheduleAuditEvent()` or `runAuditEvent()`.

### Admin Events

| Event | Action | Notes |
|---|---|---|
| Invitation sent | `admin.invitation.sent` | `meta: { invitedEmail, invitedBy }` |
| Onboarding: account created | `admin.onboarding.account_created` | |
| Onboarding: TOTP configured | `admin.onboarding.totp_configured` | |
| Onboarding: backup codes acknowledged | `admin.onboarding.backup_codes_acknowledged` | |
| Onboarding: passkey registered | `admin.onboarding.passkey_registered` | Optional step |
| Onboarding: passkey skipped | `admin.onboarding.passkey_skipped` | Admin chose "Skip for now" |
| Onboarding: completed | `admin.onboarding.completed` | |
| Login: via passkey | `admin.auth.sign_in` | `meta: { method: "passkey" }` |
| Login: via password+TOTP | `admin.auth.sign_in` | `meta: { method: "password" }` |
| Recovery: backup code used | `admin.recovery.backup_code_used` | |
| Recovery: email bypass | `admin.recovery.email_bypass_used` | Include IP |
| Account disabled | `admin.account.disabled` | `reason` field |
| Account created | `admin.account.created` | |
| Emergency reset | `admin.emergency_reset.executed` | `meta: { initiatedVia }` |

### User Events

| Event | Action | Notes |
|---|---|---|
| Sign-up | `user.auth.sign_up` | |
| Login: via password | `user.auth.sign_in` | `meta: { method: "password" }` |
| Login: via magic link | `user.auth.sign_in` | `meta: { method: "magic_link" }` |
| Login: via passkey | `user.auth.sign_in` | `meta: { method: "passkey" }` |
| 2FA enabled | `user.security.totp_enabled` | |
| 2FA disabled | `user.security.totp_disabled` | |
| Passkey registered | `user.security.passkey_registered` | |
| Recovery: backup code used | `user.recovery.backup_code_used` | |
| Password reset | `user.auth.password_reset` | |


## 13. Onboarding Copy

### Admin Onboarding Intro

> **Before you begin, understand these three things:**
>
> **1. Your email is permanent.** Better Auth ties your admin identity to your email address. It cannot be changed. If your email is compromised, you'll need a new admin account.
>
> **2. You'll create a password for setup purposes.** Two-factor authentication requires a password to activate. You'll store it in your password manager and may never type it again — but it must exist. After setup, you can sign in with a passkey instead.
>
> **3. Save your backup codes.** You'll receive single-use recovery codes. Store them somewhere safe — a password manager entry, a printed page, a secure note. They are your recovery path if everything else fails.

### User Sign-Up

No special intro needed. The sign-up form is standard: email, password (with strength meter), submit. Additional security options (2FA, passkey) are available from account settings after sign-up.


## 14. Route Middleware

### Admin App

The admin app uses three route groups with different auth levels:

**`(auth)` group** — guest-only pages (sign-in, forgot-password). Wrapped in `GuestGuard` which redirects authenticated users to `/dashboard`.

**`(onboarding)` group** — the onboarding wizard. No `AuthGuard` or `GuestGuard` — it handles both unauthenticated (fresh invite with token) and authenticated (resume after abandonment) sessions. Only applies `ForceSystemTheme`.

**`(dashboard)` group** — all protected admin pages. The server-side layout enforces:

```
1. Valid Better Auth session exists                       → else redirect to /api/auth/clear-session
2. user.role === "admin"                                  → else redirect to /api/auth/clear-session
3. user.banned !== true                                   → else redirect to /forbidden
4. adminInvitations.getMyOnboardingStatus.completed       → else redirect to /onboarding
```

Step 4 queries `getMyOnboardingStatus` which looks up the admin's invitation record by email. If the status is not `"completed"` (i.e., `"claimed"` with an in-progress `onboardingStep`), the admin is redirected to `/onboarding` to continue the wizard. Admins with no invitation record (e.g., bootstrap admins with `status: "completed"`, or admins created before Stage 6) pass through — `getMyOnboardingStatus` returns `{ completed: true }` for admins with no record or with `status: "completed"`.

> **Note:** This check uses invitation status, NOT `twoFactorEnabled`. This is intentional — it ensures ALL onboarding steps are enforced (TOTP, backup codes, passkey decision), not just 2FA. Stage 7 will add the `twoFactorEnabled` check for forced enrollment of existing admins who were never invited.

### Web App

```
1. Valid Better Auth session exists      → else redirect to /sign-in
2. user.role !== "admin"                 → else 403 (admins cannot use the web app)
3. user.isBanned !== true                → else 403 with explanation
4. If userMfaRequired === "mandatory":
   user.twoFactorEnabled === true        → else redirect to /setup-2fa
5. If userEmailVerificationRequired:
   user.emailVerified === true           → else redirect to /verify-email
```


## 15. Convex-Specific Implementation Notes

- `twoFactor.enable({ password })` and `getTotpUri({ password })` both require a credential (email+password) account. This is why every account starts with email+password.
- The `adminEmails` table (bootstrap allow-list) gates the initial admin creation and protects those accounts from being banned.
- Security policy settings (`userMagicLinkEnabled`, `userMfaRequired`, `userPasskeyPolicy`) are stored in `appSettings` and read at request time via `api.appSettings.getPublic()`.

### 15.1 `adminInvitations` Table Schema

Admin invitation tokens, onboarding progress, and lifecycle state are all stored on the `adminInvitations` table:

```typescript
adminInvitations: defineTable({
  email: v.string(),
  token: v.optional(v.string()),                    // 64-hex-char crypto-random token
  status: v.union(
    v.literal("invited"),                            // token sent, awaiting signup
    v.literal("claimed"),                            // account created, onboarding in progress
    v.literal("completed"),                          // all steps done
  ),
  onboardingStep: v.optional(v.number()),            // 1=TOTP, 2=backup codes, 3=passkey
  invitedAt: v.number(),
  invitationExpiresAt: v.optional(v.number()),       // token expiry timestamp
  claimedAt: v.optional(v.number()),                 // when account was created
  createdAt: v.number(),
})
  .index("by_email", ["email"])
  .index("by_created", ["createdAt"])
  .index("by_token", ["token"])
```

Key functions on this table:
- `invite` — creates/updates invitation, adds email to `adminEmails`, schedules token generation + email
- `validateToken` — public query, returns `{ valid, email }` or `{ valid: false, reason }`
- `claimInvitation` — public mutation, sets `"claimed"` + `onboardingStep: 1` (called after account creation)
- `advanceOnboardingStep` — authenticated mutation, updates `onboardingStep` after each wizard step
- `completeOnboarding` — authenticated mutation, sets `"completed"`, clears `onboardingStep`
- `getMyOnboardingStatus` — authenticated query, returns `{ completed, step }` (used by dashboard layout)
- `hasValidAdminInvitation` — internal query, checks if email has a valid invitation (used by auth hook)

### 15.2 Token Generation

Tokens are generated in an `internalAction` (`adminInvitationActions.generateTokenAndSendEmail`) following the same pattern as waitlist token generation:
- 32 bytes from `crypto.getRandomValues` → 64 hex characters
- Stored on the invitation row via `internal.adminInvitations.setToken`
- Expiry defaults to 7 days (configurable via `invitationTokenExpiryDays` in `appSettings`)
- Email sent via Resend (falls back to console.log in dev when `RESEND_API_KEY` is not set)


## 16. Security Checklist

### Both Apps

- [ ] Email provider operational (send a test message)
- [ ] `@zxcvbn-ts/core` installed and score-4 enforced server-side
- [ ] Better Auth `haveibeenpwned` plugin enabled
- [ ] Password minimums enforced server-side (40 admin, 15 user)
- [ ] Weak passwords rejected at API level, not just UI
- [ ] TOTP secret key hidden by default, shown only on button click
- [ ] Banned users ejected immediately on next request
- [ ] Audit trail events written for all auth events

### Admin App

- [ ] Every admin has a credential (email+password) account
- [ ] 2FA mandatory — dashboard inaccessible without TOTP setup
- [ ] Passkey login does NOT prompt for TOTP
- [ ] Password login DOES prompt for TOTP
- [ ] `trustDevice` disabled for admin accounts
- [ ] Admin invitation sends to single email, scoped to admin app
- [ ] Invitation link pre-fills email and marks it verified
- [ ] Admin accounts cannot access web app
- [ ] Bootstrap admin emails protected from ban
- [ ] Emergency reset script documented and runnable via `bunx convex run`

### Web App

- [ ] User accounts cannot access admin app
- [ ] Magic link only available when `userMagicLinkEnabled` is true
- [ ] 2FA enforcement respects `userMfaRequired` setting
- [ ] Passkey login does NOT prompt for TOTP (regardless of 2FA status)
- [ ] Password and magic link login DO prompt for TOTP when 2FA is enabled
- [ ] User invitation scoped to web app only
