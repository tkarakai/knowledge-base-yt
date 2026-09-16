# Deployment Runbook

Step-by-step procedures for deploying, operating, and rolling back the monorepo. Covers one-time infrastructure setup, first deployment, day-to-day operations, and rollback.

For pipeline architecture, failure modes, and migration examples, see [deployment-architecture.md](./deployment-architecture.md).

**How the pipeline works:** Push to `main` triggers automatic staging deployment (CI, build changed apps, deploy). After manual QA, promote to production via manual trigger. Six Vercel projects (3 staging, 3 production), two Convex projects (staging, production). Nothing reaches production without passing through staging first.

---

## 1. Prerequisites

### Accounts

| Service | Tier | URL |
|---------|------|-----|
| GitHub | Free (public) or Team (private) | github.com |
| Vercel | Hobby (free) or Pro | vercel.com |
| Convex | Starter (free) or Pro | convex.dev |

> **Why not the Convex Vercel Marketplace integration?** Convex is available as a solution in the [Vercel Marketplace](https://vercel.com/marketplace). If you use it, all Convex account creation, database management, and billing (if applicable) happens inside your Vercel account. We intentionally keep Convex and Vercel as independent accounts so we can manage each service, its billing, and its configuration separately. This guide assumes standalone Convex and Vercel accounts.

### CLI Tools

```bash
# Vercel CLI
bun add -g vercel

# Convex CLI (used via bunx, no global install needed)
bunx convex --version

# GitHub CLI
brew install gh
gh auth login
```

### Free Tier Limits

| Service | Limit | Expected Usage |
|---------|-------|----------------|
| GitHub Actions | 2,000 min/month (private) | ~200 min/month |
| GitHub Artifacts | 500 MB (private) | ~100 MB/month |
| Vercel Hobby | 1 person, up to 200 projects | 6 projects (3 staging + 3 production) |
| Convex Starter | 2 projects needed (staging + production) | Check [pricing](https://convex.dev/pricing) for project limits |

---

## 2. One-Time Infrastructure Setup

Complete these steps once, in order.

> **Automated staging setup:** For the staging environment (steps 2a–2e), you can use the interactive setup script instead of following the manual steps below:
> ```bash
> bun run infra:setup:staging
> ```
> The script collects all inputs upfront, shows a summary for confirmation, then executes each step with individual approval. It checks for existing resources before creating them, so it's safe to re-run. See `scripts/infra-setup-staging.sh --help` for details. Production setup must still be done manually.

### 2a. Create Convex Projects

Each Convex project comes with a production deployment and one dev deployment per team member. Dev deployments are for local development; you can't repurpose them as a shared staging environment. Instead, create **two separate projects** — one for staging, one for production.

**Create two projects** in the [Convex dashboard](https://dashboard.convex.dev):

1. Click "Create Project" → name it `my-app-staging` (or similar)
2. Click "Create Project" again → name it `my-app-production`

**Record the deployment URLs** for each project. In the [Convex dashboard](https://dashboard.convex.dev), select a project → Settings → General, and copy the values of "Deployment URL" and "HTTP Actions URL".

Make sure that you have "Production" designation selected for the project (even for the Staging project).

| Value | Where to find it | Staging | Production |
|-------|-------------------|---------|------------|
| Deployment URL → `NEXT_PUBLIC_CONVEX_URL` | Deployment Settings | `https://xxx.convex.cloud` | `https://yyy.convex.cloud` |
| HTTP Actions URL → `NEXT_PUBLIC_CONVEX_SITE_URL` | Deployment Settings | `https://xxx.convex.site` | `https://yyy.convex.site` |

**Generate deploy keys** for each project:

1. In each project's Deployment Settings, click **"Generate Production Deploy Key"**
2. Save both keys — you'll add them to GitHub in step 2e

| Value | Staging | Production |
|-------|---------|------------|
| Deploy Key | `prod:xxx...` | `prod:yyy...` |

> **Note:** Environment variables (`SITE_URL`, `BETTER_AUTH_SECRET`) will be configured in step 2c, after Vercel projects exist and their URLs are known.

### 2b. Create Vercel Projects

Create six Vercel projects — three for staging and three for production. Each project serves a single environment, so there's no need to split environment variables across Vercel's Preview/Production scopes.

Choose **either** the dashboard or CLI approach.

**Option A — Dashboard (requires GitHub connection):**

1. **Install the Vercel GitHub App** (one-time): When you click "Add New Project" in the [Vercel dashboard](https://vercel.com/dashboard), Vercel prompts you to install its GitHub App. Grant access to your repository. This is a GitHub App, not an OAuth token — it lets Vercel read your repo to detect framework settings.

2. **Import the repository six times** (once per project). For each: click "Add New Project" → "Import Git Repository" → select your repo → set the **Root Directory** and confirm the **Framework Preset** is **Next.js**:

   | Project Name | Root Directory | Framework Preset | Environment |
   |--------------|----------------|------------------|-------------|
   | `my-app-web` | `apps/web` | **Next.js** | Production |
   | `my-app-admin` | `apps/admin` | **Next.js** | Production |
   | `my-app-landing` | `apps/landing` | **Next.js** | Production |
   | `my-app-web-staging` | `apps/web` | **Next.js** | Staging |
   | `my-app-admin-staging` | `apps/admin` | **Next.js** | Staging |
   | `my-app-landing-staging` | `apps/landing` | **Next.js** | Staging |

   > **Important:** Both Root Directory and Framework Preset are required on all six projects. The CI/CD build runs `vercel build` from the monorepo root to avoid a [Turbopack path-doubling bug](https://github.com/vercel/next.js/issues/88579). **Root Directory** tells the `@vercel/next` builder which app to build. **Framework Preset = Next.js** ensures the correct builder is used (without it, Vercel falls back to `@vercel/static-build` and fails).

**Option B — CLI (no GitHub connection needed):**

```bash
# Authenticate with Vercel (one-time)
vercel login

# Production projects
vercel project add my-app-web
vercel project add my-app-admin
vercel project add my-app-landing

# Staging projects
vercel project add my-app-web-staging
vercel project add my-app-admin-staging
vercel project add my-app-landing-staging
```

**Disable automatic deployments** on all six projects (required — our CI/CD pipeline manages deployments via `vercel deploy` in GitHub Actions):

- **Dashboard:** Project Settings → **Build & Development Settings** → **Ignored Build Step** → select **"Don't build anything"**
- **Or via `vercel.json`** in each app directory:
  ```json
  { "git": { "deploymentEnabled": false } }
  ```

Note that you do not have to have git connected from Vercel at all.

**Record the project IDs and app URLs:**

```bash
# Via CLI
vercel whoami          # Shows org/user ID
vercel project ls      # Lists projects with IDs
```

Or in the dashboard: each project's **Settings → General → scroll to "Project ID"**.

| Value | ID |
|-------|-----|
| Vercel Org ID | `team_xxx` or `usr_xxx` |
| my-app-web Project ID | `prj_xxx` |
| my-app-admin Project ID | `prj_yyy` |
| my-app-landing Project ID | `prj_zzz` |
| my-app-web-staging Project ID | `prj_aaa` |
| my-app-admin-staging Project ID | `prj_bbb` |
| my-app-landing-staging Project ID | `prj_ccc` |

Also note each project's **auto-assigned Vercel URL** (visible in each project's **Deployments** page or **Settings → Domains**). You'll need these in step 2c for Convex's `SITE_URL`:

| Project | Vercel URL (example) |
|---------|---------------------|
| my-app-web | `https://my-app-web.vercel.app` |
| my-app-admin | `https://my-app-admin.vercel.app` |
| my-app-landing | `https://my-app-landing.vercel.app` |
| my-app-web-staging | `https://my-app-web-staging.vercel.app` |
| my-app-admin-staging | `https://my-app-admin-staging.vercel.app` |
| my-app-landing-staging | `https://my-app-landing-staging.vercel.app` |

> **Note:** Environment variables for Vercel projects are configured in step 2d, after Convex URLs are known.

### 2c. Configure Convex Environment Variables

Now that both Convex projects and Vercel projects exist, you know all the URLs. Set environment variables on each Convex project.

In this repo, the **web app** (`apps/web`) and **admin app** (`apps/admin`) authenticate against Convex — their URLs go in `SITE_URL` (Better Auth trusted origins). The admin app's URL also goes in `ADMIN_SITE_URL` (used for admin-specific CORS and invitation email links). The **landing page** (`apps/landing`) also connects to Convex via HTTP actions for the waitlist API, so its URL goes in `LANDING_URL` (CORS origins in `packages/backend/convex/http.ts`). Storybook does not connect to Convex.

**Option A — Convex Dashboard (recommended for one-time setup):**

For each Convex project, go to **Deployment Settings → Environment Variables** and add:

| Variable | Staging project value | Production project value |
|----------|-----------------------|--------------------------|
| `SITE_URL` | `https://your-staging-web.vercel.app,https://your-staging-admin.vercel.app` | `https://your-production-web.vercel.app,https://your-production-admin.vercel.app` |
| `ADMIN_SITE_URL` | `https://your-staging-admin.vercel.app` | `https://admin.yourdomain.com` |
| `PASSKEY_RP_ID` *(optional)* | `staging.yourdomain.com` | `yourdomain.com` |
| `LANDING_URL` | `https://your-staging-landing.vercel.app` | `https://yourdomain.com` |
| `BETTER_AUTH_SECRET` | *(generate — see below)* | *(generate — see below)* |

To generate `BETTER_AUTH_SECRET`, run this in your terminal and paste the output:

```bash
openssl rand -base64 32
```

> **IMPORTANT:** Generate a **separate** secret for each project (staging ≠ production). Each call to `openssl rand` produces a unique value.

**Option B — CLI with deploy keys:**

Use the deploy keys from step 2a to target each project's production deployment. The `CONVEX_DEPLOY_KEY` env var authenticates the CLI and selects the correct deployment in a single step — no need to modify `.env.local`:

```bash
# ── Staging project ──────────────────────────────────────
# Use the staging project's deploy key (from step 2a)
CONVEX_DEPLOY_KEY='prod:your-staging-deploy-key' \
  bunx convex env set SITE_URL "https://your-staging-web.vercel.app,https://your-staging-admin.vercel.app"

CONVEX_DEPLOY_KEY='prod:your-staging-deploy-key' \
  bunx convex env set ADMIN_SITE_URL "https://your-staging-admin.vercel.app"

CONVEX_DEPLOY_KEY='prod:your-staging-deploy-key' \
  bunx convex env set PASSKEY_RP_ID "staging.yourdomain.com"

CONVEX_DEPLOY_KEY='prod:your-staging-deploy-key' \
  bunx convex env set LANDING_URL "https://your-staging-landing.vercel.app"

CONVEX_DEPLOY_KEY='prod:your-staging-deploy-key' \
  bunx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"

# ── Production project ───────────────────────────────────
# Use the production project's deploy key (from step 2a)
CONVEX_DEPLOY_KEY='prod:your-production-deploy-key' \
  bunx convex env set SITE_URL "https://your-production-web.vercel.app,https://your-production-admin.vercel.app"

CONVEX_DEPLOY_KEY='prod:your-production-deploy-key' \
  bunx convex env set ADMIN_SITE_URL "https://admin.yourdomain.com"

CONVEX_DEPLOY_KEY='prod:your-production-deploy-key' \
  bunx convex env set PASSKEY_RP_ID "yourdomain.com"

CONVEX_DEPLOY_KEY='prod:your-production-deploy-key' \
  bunx convex env set LANDING_URL "https://yourdomain.com"

CONVEX_DEPLOY_KEY='prod:your-production-deploy-key' \
  bunx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
```

> **How `SITE_URL` works:** The auth config in `packages/backend/convex/auth.ts` parses `SITE_URL` as a comma-separated list and passes all origins to Better Auth's `trustedOrigins`. This allows both the web app and admin app to authenticate against the same Convex backend.
>
> **How `ADMIN_SITE_URL` works:** The HTTP router in `packages/backend/convex/http.ts` and session management in `sessions.ts` use `ADMIN_SITE_URL` for CORS allowed-origins on admin-specific endpoints. The admin invitation system in `adminInvitationActions.ts` uses it to construct invitation email links.
>
> **How `PASSKEY_RP_ID` works:** Passkeys use a single relying party ID (RP ID). If web/admin must both use passkeys, set `PASSKEY_RP_ID` to a shared parent domain (for example `staging.example.com` for `web.staging.example.com` and `admin.staging.example.com`). With default `*.vercel.app` hostnames, this shared RP setup is generally not viable; use custom domains.
>
> **How `LANDING_URL` works:** The HTTP router in `packages/backend/convex/http.ts` reads `LANDING_URL` to build the CORS allowed-origins list for the waitlist API endpoints (`/api/waitlist/status`, `/api/waitlist/join`). Without it, the landing app's cross-origin requests to Convex would be blocked.

### 2d. Configure Vercel Environment Variables

Set environment variables for each Vercel project. Use the Convex URLs recorded in step 2a. Since each Vercel project serves a single environment, all variables use the **Production** scope only.

**my-app-web (production):**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_CONVEX_URL` | Production Convex URL |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Production Convex Site URL |
| `NEXT_PUBLIC_SITE_URL` | `https://web.yourdomain.com` |
| `NEXT_PUBLIC_LANDING_URL` | `https://yourdomain.com` |

**my-app-web-staging:**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_CONVEX_URL` | Staging Convex URL |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Staging Convex Site URL |
| `NEXT_PUBLIC_SITE_URL` | `https://my-app-web-staging.vercel.app` |
| `NEXT_PUBLIC_LANDING_URL` | `https://my-app-landing-staging.vercel.app` |

**my-app-admin (production):**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_CONVEX_URL` | Production Convex URL |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Production Convex Site URL |
| `NEXT_PUBLIC_SITE_URL` | `https://admin.yourdomain.com` |

**my-app-admin-staging:**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_CONVEX_URL` | Staging Convex URL |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Staging Convex Site URL |
| `NEXT_PUBLIC_SITE_URL` | `https://my-app-admin-staging.vercel.app` |

**my-app-landing (production)** — connects to Convex via HTTP actions for the waitlist API:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Production Convex Site URL |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` |
| `NEXT_PUBLIC_WEB_APP_URL` | `https://web.yourdomain.com` |

**my-app-landing-staging:**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Staging Convex Site URL |
| `NEXT_PUBLIC_SITE_URL` | `https://my-app-landing-staging.vercel.app` |
| `NEXT_PUBLIC_WEB_APP_URL` | `https://my-app-web-staging.vercel.app` |

Set these in each project's Settings → Environment Variables using the **Production** scope.

> **Cross-app linking:** The apps link to each other at runtime — the landing page has "Get Started" / "Sign In" buttons pointing to the web app (`NEXT_PUBLIC_WEB_APP_URL`), and the web app has Terms/Privacy and back-to-landing links pointing to the landing page (`NEXT_PUBLIC_LANDING_URL`). These are non-secret config values baked into the JS bundle at build time. Set them once per Vercel project and they'll be pulled automatically during CI/CD builds via `vercel pull`. In local dev, `dev-start.sh` sets them automatically.

### 2e. GitHub Configuration

GitHub Actions is the deployment orchestrator. We disabled Vercel's built-in Git-triggered deploys (step 2b) — instead, CD workflows in GitHub Actions run `vercel deploy` and `convex deploy` to push builds. That's why GitHub needs credentials for both Vercel and Convex.

**Create environments** (Settings > Environments):

1. **`staging`**
   - Deployment branches: `main` only
   - No protection rules (auto-deploy on every push)

2. **`production`**
   - Deployment branches: `main` only
   - Required reviewers: add at least one person
   - Wait timer: 15 minutes (optional, gives time to cancel)

**Add repository secrets** (Settings > Secrets and Variables > Actions > Repository secrets):

These are used by the CD workflows to authenticate with Vercel when running `vercel deploy`:

| Secret | Value | Where to get it |
|--------|-------|-----------------|
| `VERCEL_TOKEN` | Vercel personal access token | [Vercel dashboard](https://vercel.com/account/tokens) → Create Token |
| `VERCEL_ORG_ID` | Your Vercel org/user ID | From step 2b |
| `VERCEL_PROJECT_ID_WEB` | web production project ID | From step 2b |
| `VERCEL_PROJECT_ID_ADMIN` | admin production project ID | From step 2b |
| `VERCEL_PROJECT_ID_LANDING` | landing production project ID | From step 2b |
| `VERCEL_PROJECT_ID_WEB_STAGING` | web staging project ID | From step 2b |
| `VERCEL_PROJECT_ID_ADMIN_STAGING` | admin staging project ID | From step 2b |
| `VERCEL_PROJECT_ID_LANDING_STAGING` | landing staging project ID | From step 2b |

> **Note:** All `VERCEL_PROJECT_ID_*` secrets must be **repository secrets** (not environment secrets) because the CD workflow build jobs run without an `environment:` context and can only access repository-level secrets.

**Add environment secrets** (Settings > Environments > [env] > Environment secrets):

The CD workflows run `convex deploy` with this key to push backend functions to the correct Convex project:

| Secret | `staging` | `production` |
|--------|-----------|--------------|
| `CONVEX_DEPLOY_KEY` | Staging deploy key (from step 2a) | Production deploy key (from step 2a) |

> **Note:** `CONVEX_DEPLOY_KEY` is an **environment** secret (not repository secret) because the staging and production workflows must push to different Convex projects. Each GitHub environment gets the deploy key for its corresponding Convex project.

**Configure branch protection** (Settings > Branches > `main`):

- [x] Require a pull request before merging
- [x] Require status checks to pass before merging
  - Required: `CI Shared / CI Shared Complete`
  - Required: `CI Web / CI Web Complete`
  - Required: `CI Admin / CI Admin Complete`
  - Required: `CI Landing / CI Landing Complete`
- [x] Require branches to be up to date before merging

> **How it works:** The 4 CI workflows (`ci-shared.yml`, `ci-web.yml`, `ci-admin.yml`, `ci-landing.yml`) run on every pull request. Each workflow has a summary job (e.g., "CI Shared Complete") that passes only when all of that workflow's checks succeed. Branch protection requires all 4 summary jobs to pass before a PR can be merged.
>
> On push to main (after a PR is merged), the unified `cd-staging.yml` workflow calls these same CI workflows as reusable workflows, then detects which apps changed, builds only those, and deploys to staging. It also sets a `ci/gate-passed` commit status that `cd-production.yml` checks before allowing production deploys.

### 2f. Custom Domains (Production)

**Vercel domains** (per project, Settings > Domains):

| Project | Domain |
|---------|--------|
| landing-app | `yourdomain.com` |
| web-app | `app.yourdomain.com` (or `web.yourdomain.com`) |
| admin-app | `admin.yourdomain.com` |

Add the domain in Vercel, then configure DNS at your registrar:

```
# CNAME records (if using subdomains)
app.yourdomain.com     CNAME  cname.vercel-dns.com
admin.yourdomain.com   CNAME  cname.vercel-dns.com

# A record (if using apex domain for landing)
yourdomain.com         A      76.76.21.21
```

Vercel provisions SSL certificates automatically.

**Update Vercel environment variables** after adding custom domains — the `NEXT_PUBLIC_SITE_URL` production values (step 2d) should use the custom domain instead of `.vercel.app` URLs.

**Update Convex environment variables** in the production project to match the custom domains:

```bash
# Via dashboard: Deployment Settings → Environment Variables
# Or via CLI with the production deploy key:
CONVEX_DEPLOY_KEY='prod:your-production-deploy-key' \
  bunx convex env set SITE_URL "https://app.yourdomain.com,https://admin.yourdomain.com"

CONVEX_DEPLOY_KEY='prod:your-production-deploy-key' \
  bunx convex env set ADMIN_SITE_URL "https://admin.yourdomain.com"

CONVEX_DEPLOY_KEY='prod:your-production-deploy-key' \
  bunx convex env set LANDING_URL "https://yourdomain.com"
```

---

## 3. Pre-Deployment Checklist

Run through this checklist before the first deployment or any major infrastructure change.

### Code Readiness

- [ ] All CI checks pass locally: `bun run ci`
- [ ] No `console.log` debugging statements in production code
- [ ] TypeScript strict mode passes: `bun run typecheck`
- [ ] Linting passes: `bun run lint`
- [ ] All tests pass: `bun run test:all`
- [ ] Production build succeeds: `bun run build`

### Infrastructure Readiness

- [ ] Two Convex projects created: staging and production (step 2a)
- [ ] Convex deployment URLs and deploy keys recorded for both projects (step 2a)
- [ ] Six Vercel projects created: 3 staging + 3 production (step 2b)
- [ ] Vercel Root Directory set to `apps/<app>` on all 6 projects (step 2b)
- [ ] Vercel Framework Preset set to **Next.js** on all 6 projects (step 2b)
- [ ] Vercel automatic deployments disabled for all 6 projects (step 2b)
- [ ] Convex environment variables set: `SITE_URL`, `ADMIN_SITE_URL`, `LANDING_URL`, `BETTER_AUTH_SECRET` (and `PASSKEY_RP_ID` if using cross-subdomain passkeys) per project (step 2c)
- [ ] `BETTER_AUTH_SECRET` is unique per project (staging ≠ production)
- [ ] Vercel environment variables set (Production scope) on all 6 projects (step 2d)
- [ ] GitHub `staging` environment created (step 2e)
- [ ] GitHub `production` environment created with required reviewers (step 2e)
- [ ] All repository secrets set: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_*`, `VERCEL_PROJECT_ID_*_STAGING` (step 2e)
- [ ] All environment secrets set: `CONVEX_DEPLOY_KEY` per environment (step 2e)
- [ ] Branch protection enabled on `main` with required status checks (step 2e)

### Verify Configuration

```bash
# Verify Convex env vars (run for each project using its deploy key)
CONVEX_DEPLOY_KEY='prod:your-staging-deploy-key' bunx convex env list
CONVEX_DEPLOY_KEY='prod:your-production-deploy-key' bunx convex env list
# Each should show: SITE_URL, ADMIN_SITE_URL, LANDING_URL, BETTER_AUTH_SECRET (and PASSKEY_RP_ID if used)

# Verify GitHub secrets are set (no way to read values, but check they exist)
gh secret list
gh secret list --env staging
gh secret list --env production

# Verify branch protection
gh api repos/{owner}/{repo}/branches/main/protection --jq '.required_status_checks.contexts[]'
# Should list:
#   CI Shared / CI Shared Complete
#   CI Web / CI Web Complete
#   CI Admin / CI Admin Complete
#   CI Landing / CI Landing Complete
```

---

## 4. First Deployment

### Step 1: Deploy to Staging

Staging deploys automatically on every push to `main`. For the first deployment:

```bash
# Ensure you're on main and up to date
git checkout main
git pull origin main

# Push (or merge a PR)
git push origin main
```

**Monitor the pipeline:**

```bash
# Watch the unified staging workflow (CI + build + deploy in one run)
gh run list --workflow=cd-staging.yml --limit 1
gh run watch $(gh run list --workflow=cd-staging.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

### Step 2: Bootstrap the First Admin

On a fresh deployment the database is empty — no admin user exists yet. The `bootstrap` module provides internal functions to seed the first admin without needing a UI.

**Run from the Convex dashboard** (Dashboard → select your project → Functions → `bootstrap:initialize`):

```
bootstrap:initialize  { "email": "you@example.com" }
```

Or via CLI with the deploy key:

```bash
CONVEX_DEPLOY_KEY='prod:your-staging-deploy-key' \
  bunx convex run bootstrap:initialize '{"email": "you@example.com"}'
```

This will:
1. Add the email to the `adminEmails` table
2. Create a waitlist entry and mark it as "invited"
3. Send an invitation email (or log the token to the Convex dashboard if no `RESEND_API_KEY` is set)

**Check your email** for the invitation link and complete registration to claim the admin account.

**Check bootstrap status** at any time:

```bash
CONVEX_DEPLOY_KEY='prod:your-staging-deploy-key' \
  bunx convex run bootstrap:status '{}'
```

The `status` function returns the current state and an actionable hint (e.g. "token expired — run rescue").

**If something goes wrong** (typo in email, expired token, lost invitation):

```bash
# Fix email typo and resend invitation
CONVEX_DEPLOY_KEY='prod:your-staging-deploy-key' \
  bunx convex run bootstrap:rescue '{"currentEmail": "typo@exmaple.com", "newEmail": "correct@example.com"}'

# Same email, just resend (expired token)
CONVEX_DEPLOY_KEY='prod:your-staging-deploy-key' \
  bunx convex run bootstrap:rescue '{"currentEmail": "you@example.com", "newEmail": "you@example.com"}'
```

> **Note:** All bootstrap functions are `internalMutation`/`internalQuery` — they cannot be called from the client. The `rescue` function cannot be used after the admin has claimed the invitation (i.e. completed registration). Repeat this bootstrap step for production after promoting in Step 4.

### Step 3: Validate Staging

Once the staging workflow completes and the admin account is bootstrapped, run through this checklist:

**Automated checks (already done by the pipeline):**
- [x] All 3 apps respond to HTTP requests (smoke tests)
- [x] Git tag created: `deploy/staging/<timestamp>/<sha>`

**Manual checks:**

- [ ] **Landing page** loads at the staging URL
  - Navigation links work
  - Links to web app point to staging web URL
- [ ] **Web app** loads at the staging URL
  - Sign-up flow works (create a test account)
  - Sign-in flow works
  - Dashboard loads after sign-in
  - Sign-out works
  - Auth redirects work (visiting `/dashboard` while signed out → `/sign-in`)
- [ ] **Admin app** loads at the staging URL
  - Authentication works
  - Admin features load
- [ ] **Convex dashboard** shows the staging deployment is active
  - Functions tab shows deployed functions
  - Data tab shows tables (may be empty on first deploy)
  - Logs tab shows no errors
- [ ] **Security headers** present:
  ```bash
  curl -sI https://staging-web.vercel.app | grep -iE '(strict-transport|x-frame|x-content-type|referrer-policy|content-security)'
  ```
- [ ] **No console errors** in browser DevTools on any app

### Step 4: Promote to Production

```bash
# Find the staging deployment SHA
git fetch --tags
STAGING_SHA=$(git tag --list 'deploy/staging/*' --sort=-creatordate | head -1 | rev | cut -d'/' -f1 | rev)
echo "Staging SHA: ${STAGING_SHA}"

# Trigger production deployment
gh workflow run cd-production.yml \
  -f git_sha="${STAGING_SHA}" \
  -f confirm=deploy-production
```

**Approve the deployment** in the GitHub Actions UI:
1. Go to Actions > "Deploy Production" > the pending run
2. Click "Review deployments"
3. Select the `production` environment
4. Click "Approve and deploy"

**Monitor:**

```bash
gh run list --workflow=cd-production.yml --limit 1
gh run watch $(gh run list --workflow=cd-production.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

### Step 5: Verify Production

- [ ] All 3 production URLs respond
- [ ] Production git tag created:
  ```bash
  git fetch --tags
  git tag --list 'deploy/production/*' --sort=-creatordate | head -1
  ```
- [ ] Admin bootstrapped on production (repeat Step 2 with the production deploy key)
- [ ] Authentication works on production (sign in with the bootstrapped admin account)
- [ ] Custom domains resolve correctly (if configured)
- [ ] SSL certificates active (padlock in browser)
- [ ] Convex production deployment active in dashboard

---

## 5. Day-to-Day Operations

### Standard Deploy Flow

```
PR merged to main
       │
       ▼
cd-staging.yml runs (automatic):
  CI → change detection → build changed apps → deploy
  (~5–8 min, skips unchanged apps)
       │
       ▼
Validate staging (manual, 2–5 min)
       │
       ▼
Promote to production (manual trigger)
```

### Quick Reference Commands

```bash
# ── Check what's deployed ──────────────────────────────
# Latest staging deployment
git fetch --tags
git tag --list 'deploy/staging/*' --sort=-creatordate | head -1

# Latest production deployment
git tag --list 'deploy/production/*' --sort=-creatordate | head -1

# What's on staging but NOT yet on production
PROD_SHA=$(git tag --list 'deploy/production/*' --sort=-creatordate | head -1 | rev | cut -d'/' -f1 | rev)
STAGE_SHA=$(git tag --list 'deploy/staging/*' --sort=-creatordate | head -1 | rev | cut -d'/' -f1 | rev)
git log --oneline ${PROD_SHA}..${STAGE_SHA}

# ── Deploy to production ───────────────────────────────
gh workflow run cd-production.yml \
  -f git_sha="${STAGE_SHA}" \
  -f confirm=deploy-production

# ── Monitor a running deployment ───────────────────────
gh run list --workflow=cd-staging.yml --limit 3
gh run list --workflow=cd-production.yml --limit 3

# ── Check CI status for a commit ───────────────────────
gh api repos/{owner}/{repo}/commits/$(git rev-parse HEAD)/status \
  --jq '.statuses[] | "\(.context): \(.state)"'
```

### Deploying Hotfixes

For urgent fixes that need to skip the normal PR review flow:

1. Create a hotfix branch, make the fix, push
2. Merge to `main` (with expedited review if your branch protection requires it)
3. CI runs → staging auto-deploys
4. Quick-validate staging
5. Promote to production immediately

The pipeline is the same — you're just moving faster through the manual validation step.

---

## 6. Post-Deployment Checklist

Run after every production deployment.

- [ ] Production deployment workflow completed successfully
- [ ] Git tag created: `deploy/production/<timestamp>/<sha>`
- [ ] All 3 production apps respond with HTTP 200:
  ```bash
  curl -sI https://web.yourdomain.com | head -1
  curl -sI https://admin.yourdomain.com | head -1
  curl -sI https://yourdomain.com | head -1
  ```
- [ ] Convex production deployment shows no errors in Logs tab
- [ ] Auth flow works (sign in with a test account)
- [ ] No new error spikes in Vercel Logs (project > Logs tab)
- [ ] Deployment tagged and visible in `git tag --list 'deploy/production/*'`

---

## 7. Rollback

### Decision: Rollback vs. Roll Forward

| Scenario | Action | Why |
|----------|--------|-----|
| Bug, no schema changes | **Rollback** | Fast return to known-good state |
| Bug with additive schema changes | **Rollback** | Additive changes are backward-compatible |
| Bug with breaking schema + migrated data | **Roll forward** | Old schema may be incompatible with new data |
| Performance regression | **Rollback** | Revert to last known-good state |
| Security vulnerability | **Rollback** | Speed matters; patch forward after |
| Data corruption | **Roll forward** | Rollback doesn't undo data damage |

### Rollback Steps

```bash
# 1. Find the last known-good SHA
git fetch --tags
git tag --list 'deploy/production/*' --sort=-creatordate | head -5
# Use the SECOND entry (the deployment before the broken one)
TARGET_SHA="<sha-from-second-entry>"

# 2. Verify what's in that deployment
git log --oneline ${TARGET_SHA} -5

# 3. Trigger the rollback
gh workflow run cd-rollback.yml \
  -f environment=production \
  -f target_sha="${TARGET_SHA}" \
  -f confirm=rollback-production

# 4. Monitor
gh run watch $(gh run list --workflow=cd-rollback.yml --limit 1 --json databaseId --jq '.[0].databaseId')

# 5. Verify
git fetch --tags
git tag --list 'deploy/production/rollback/*' --sort=-creatordate | head -1
curl -sI https://web.yourdomain.com | head -1
```

> **Note:** The rollback workflow rebuilds from source — it does not reuse old artifacts. This means rollback works regardless of artifact age (90-day retention). See [deployment-architecture.md — Rollback](./deployment-architecture.md#rollback-procedures) for edge cases.

---

## 8. Schema Migrations

### Safe Changes (Deploy Directly)

These go through the normal deploy pipeline with no special handling:

- New table
- Optional field (`v.optional(...)`)
- New index
- New Convex function
- New literal added to a `v.union()`

### Breaking Changes (Two-Phase Deploy)

These require a migration strategy:

1. **Phase 1:** Add new field/table alongside old one. Deploy. Both old and new code works.
2. **Backfill:** Run a migration to populate new field from old data.
3. **Phase 2:** Remove old field/table. Deploy. Only new code works.

**Checklist for breaking schema changes:**

- [ ] Phase 1 code is backward-compatible (old frontend + new backend works)
- [ ] Phase 1 deployed to staging and validated
- [ ] Phase 1 promoted to production
- [ ] Backfill migration tested on staging
- [ ] Backfill migration run on production
- [ ] Soak period (at least one full deployment cycle before Phase 2)
- [ ] Phase 2 deployed to staging and validated
- [ ] Phase 2 promoted to production
- [ ] Verified rollback is no longer possible past Phase 1 (accepted risk)

> See [deployment-architecture.md — Convex Schema Migration Safety](./deployment-architecture.md#convex-schema-migration-safety) for detailed examples.
>
> If production was broken by a narrowed schema, use [convex-migrations.md — If production broke becasue the narrowed schema reached it before data was migrated](./convex-migrations.md#if-production-broke-becasue-the-narrowed-schema-reached-it-before-data-was-migrated).

---

## 9. Operational Health

### Where to Check Logs

| What | Where |
|------|-------|
| Application logs | Vercel dashboard > Project > Logs |
| Build logs | GitHub Actions > workflow run |
| Backend function logs | Convex dashboard > Deployment > Logs |
| Backend data | Convex dashboard > Deployment > Data |
| Deployment history | `git tag --list 'deploy/*' --sort=-creatordate` |
| CI status | GitHub Actions tab or `gh run list` |

### Deployment History

```bash
# All deployments (most recent first)
git fetch --tags
git tag --list 'deploy/*' --sort=-creatordate | head -20

# Production only
git tag --list 'deploy/production/*' --sort=-creatordate | head -10

# Staging only
git tag --list 'deploy/staging/*' --sort=-creatordate | head -10

# Rollbacks only
git tag --list 'deploy/*/rollback/*' --sort=-creatordate

# Details of a specific deployment
git tag -v '<tag-name>'
```

### Free Tier Monitoring

Check these periodically to avoid hitting limits:

| What | Where to Check | Limit |
|------|----------------|-------|
| GitHub Actions minutes | Settings > Billing > Actions | 2,000 min/month (private) |
| GitHub Artifacts storage | Settings > Billing > Actions | 500 MB (private) |
| Vercel deployments | Vercel dashboard > Usage | Unlimited (Hobby) |
| Vercel bandwidth | Vercel dashboard > Usage | 100 GB/month (Hobby) |
| Convex function calls | Convex dashboard > Usage | Varies by plan |
| Convex storage | Convex dashboard > Usage | Varies by plan |

### Alerting

No automated alerting is configured by default. Options by team size:

| Team Size | Approach | Setup Required |
|-----------|----------|----------------|
| Solo | GitHub email notifications (built-in) | Enable in repo Settings > Notifications |
| Small team | Slack webhook on deploy failure | Add `SLACK_WEBHOOK_URL` secret + workflow job |
| Production-critical | PagerDuty / Opsgenie integration | Webhook integration |

> See [deployment-architecture.md — Alerting & Notifications](./deployment-architecture.md#alerting--notifications) for implementation details.

---

## 10. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Vercel build uses `@vercel/static-build` or says "No Output Directory named public" | Framework Preset is not set to Next.js | Set Framework Preset to **Next.js** in each project (Settings > General) |
| Vercel build fails with Turbopack "can't find next/package.json" | Root Directory not set or `outputFileTracingRoot`/`turbopack.root` missing in next.config.ts | Set Root Directory to `apps/<app>` in each project; ensure next.config.ts has both settings pointing to monorepo root |
| Staging not deploying after push | CI still running in the unified workflow | Check `gh run list --workflow=cd-staging.yml`; CI phase runs first |
| All CI passed but nothing deployed | No app/backend files changed in the push | Change detection skips build/deploy for unchanged apps; expected behavior |
| Production deploy rejected | Wrong confirmation string or SHA not staged | Use exact string `deploy-production`; verify SHA has a staging tag |
| Convex deploy fails | Wrong deploy key for the environment | Check `CONVEX_DEPLOY_KEY` secret matches the target Convex project |
| App shows stale content | CDN cache or browser cache | Hard refresh; check Vercel deployment URL directly |
| Auth not working after deploy | `SITE_URL` mismatch in Convex env vars | Verify `SITE_URL` matches the actual web/admin app URL(s) |
| Passkey registration fails with RP ID/domain error | RP ID does not match current app hostname | Set `PASSKEY_RP_ID` to a shared parent domain and use custom web/admin subdomains under it |
| Waitlist form CORS errors on landing | `LANDING_URL` not set or mismatched in Convex env vars | Verify `LANDING_URL` matches the landing app's URL |
| `BETTER_AUTH_SECRET` error | Secret not set or empty | Run `bunx convex env list` in the target project (set `CONVEX_DEPLOYMENT` first) |
| Vercel build fails | Missing environment variables | Check Vercel dashboard > Project > Settings > Environment Variables |
| Rollback fails on schema | New data incompatible with old schema | Roll forward instead; see [Schema Migrations](#8-schema-migrations) and [Emergency re-widen runbook](./convex-migrations.md#if-production-broke-becasue-the-narrowed-schema-reached-it-before-data-was-migrated) |
| Health checks timeout | Cold start or CDN propagation | Re-run the job; if persistent, check Vercel logs |

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────┐
│                  DEPLOY COMMANDS                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Check staging SHA:                                 │
│  git tag -l 'deploy/staging/*' --sort=-creatordate | head -1 │
│                                                     │
│  Promote to production:                             │
│  gh workflow run cd-production.yml \                │
│    -f git_sha=<SHA> -f confirm=deploy-production   │
│                                                     │
│  Rollback production:                               │
│  gh workflow run cd-rollback.yml \                  │
│    -f environment=production \                      │
│    -f target_sha=<SHA> \                            │
│    -f confirm=rollback-production                   │
│                                                     │
│  Monitor deployment:                                │
│  gh run list --workflow=cd-production.yml -L1       │
│  gh run watch <RUN_ID>                              │
│                                                     │
│  Check CI status:                                   │
│  gh run list --workflow=cd-staging.yml -L1          │
│  gh run view <RUN_ID>                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```
