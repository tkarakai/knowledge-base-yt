# Deployment Architecture

This document explains the design and internals of the CI/CD pipeline — how it works, why it's built this way, and what happens when things fail. For step-by-step operational procedures, see [deployment-runbook.md](./deployment-runbook.md).

## Why This Architecture

There are several ways to wire up CI/CD with GitHub, Vercel, and Convex. We evaluated the common approaches and chose the one that gives us the most control.

### Alternative: Vercel Git Integration

The most popular approach. You connect your GitHub repo to Vercel, and Vercel triggers builds automatically on every push. Vercel handles CI/CD internally — no GitHub Actions needed for deployment.

**Why we don't use it:** It locks the entire build and deploy pipeline into Vercel. If we ever want to switch hosting providers (e.g., to Cloudflare, Netlify, or self-hosted), we'd have to rebuild the CI/CD pipeline from scratch. By not connecting Vercel to git at all, Vercel is just a hosting target — swappable without touching CI.

### Alternative: Vercel Convex Marketplace Integration

Convex is available as a [Vercel Marketplace](https://vercel.com/marketplace) solution. With this integration, Convex account creation, database management, and billing all go through your Vercel account.

**Why we don't use it:** We want independent control over backend billing and configuration. Keeping Convex and Vercel as separate accounts means we can manage each service's pricing, limits, and settings independently. If we scale one service differently than the other, we're not tied to a bundled plan.

### Our Approach: GitHub Actions as CI/CD Orchestrator

We build everything in GitHub Actions and push prebuilt artifacts to Vercel via `vercel deploy --prebuilt`. Convex is deployed separately via `convex deploy`. Vercel is used purely as a static hosting target.

**What this gives us:**
- **No vendor lock-in** — if we switch away from Vercel, only the deploy action changes. CI, builds, testing, and Convex deployment are completely unaffected.
- **Full pipeline control** — we own the build caching, change detection, artifact attestation, and deployment ordering. Nothing is a black box.
- **Independent backend** — Convex has its own deploy keys, its own billing, and deploys on its own schedule (always before frontends).
- **Auditability** — every deployment is traceable through git tags, SLSA attestations, and GitHub Actions logs.

The trade-off is more initial setup (see [deployment-runbook.md — One-Time Infrastructure Setup](./deployment-runbook.md#2-one-time-infrastructure-setup)) and maintaining the GitHub Actions workflows ourselves.

## Architecture

```
Push to main → cd-staging.yml (one unified workflow)
  │
  ├─ CI phase (4 reusable workflow calls, parallel)
  │   ci-shared ─┐
  │   ci-web ────┤
  │   ci-admin ──┤  all must pass
  │   ci-landing─┘
  │
  ├─ CI Gate (sets ci/gate-passed commit status)
  │
  ├─ Change detection (which apps/packages changed?)
  │
  ├─ Build only changed apps (vercel build)
  ├─ Checksum + SLSA attest changed artifacts
  ├─ Deploy Convex to staging (if backend changed)
  ├─ Deploy changed apps to Vercel (vercel deploy --prebuilt --prod)
  └─ Smoke tests + git tag
  │
  ▼
Deploy Production (manual trigger + approval gate)
  ├─ Verify this SHA was deployed to staging
  ├─ Build apps with production env vars (same SHA)
  ├─ Checksum + SLSA attest each artifact
  ├─ Deploy Convex to production
  ├─ Deploy 3 apps to Vercel (--prebuilt --prod)
  └─ Health checks + git tag
```

## Workflows

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| Deploy Staging | `cd-staging.yml` | Push to `main` | Unified CI + selective build/deploy to staging |
| Deploy Production | `cd-production.yml` | Manual (`workflow_dispatch`) | Deploy to production with approval gate |
| Rollback | `cd-rollback.yml` | Manual (`workflow_dispatch`) | Rollback any environment to a previous SHA |

## Composite Actions

| Action | Directory | Purpose |
|---|---|---|
| Build App | `.github/actions/build-app/` | Build a Next.js app via Vercel CLI, package as tarball |
| Deploy Vercel | `.github/actions/deploy-vercel/` | Deploy a prebuilt artifact to Vercel |
| Deploy Convex | `.github/actions/deploy-convex/` | Deploy Convex backend functions |

## How Deployments Work

### Staging (Automatic)

Every push to `main` triggers the unified `cd-staging.yml` workflow:

1. **CI phase** calls 4 CI workflows as reusable workflows (parallel)
2. **CI Gate** evaluates results and sets `ci/gate-passed` commit status
3. **Change detection** determines which apps/packages changed
4. **Build** only changed apps using `vercel build --prod` with staging project environment variables
5. **Attest** changed artifacts with SLSA build provenance via Sigstore
6. **Deploy Convex** backend (only if `packages/backend` changed)
7. **Deploy** changed apps to Vercel using `vercel deploy --prebuilt --prod`
8. **Smoke test** deployed URLs
9. **Tag** the commit with `deploy/staging/<timestamp>/<sha>`

### Production (Manual)

Trigger via GitHub Actions UI or `gh` CLI:

```bash
gh workflow run cd-production.yml \
  -f git_sha=abc1234def5678... \
  -f confirm=deploy-production
```

The workflow:
1. **Validates** the confirmation string and verifies the SHA was deployed to staging
2. **Builds** all 3 apps with production environment variables
3. **Attests** artifacts
4. **Deploys Convex** to production (requires approval from the `production` GitHub Environment)
5. **Deploys** all 3 apps to Vercel with `--prod` flag
6. **Health checks** + creates annotated git tag `deploy/production/<timestamp>/<sha>`

### Rollback

Trigger via GitHub Actions UI or `gh` CLI:

```bash
# Rollback staging
gh workflow run cd-rollback.yml \
  -f environment=staging \
  -f target_sha=abc1234def5678... \
  -f confirm=rollback-staging

# Rollback production
gh workflow run cd-rollback.yml \
  -f environment=production \
  -f target_sha=abc1234def5678... \
  -f confirm=rollback-production
```

The rollback workflow rebuilds from the target SHA and redeploys. This ensures deterministic artifacts even if the original artifacts have expired (90-day retention).

## Artifact Security

### Checksums
Every build artifact (`.tar.gz`) has a companion `.sha256` checksum file. Checksums are verified before deployment.

### SLSA Build Provenance
Each artifact is attested using `actions/attest-build-provenance@v2` (Sigstore), providing SLSA Build Level 2 provenance. Verify with:

```bash
gh attestation verify <artifact.tar.gz> --repo owner/repo
```

### Build Manifest
Each build produces a JSON manifest recording: git SHA, environment, timestamp, workflow run URL, artifact checksum, and runner details.

### Git Tags
Every deployment creates a tag for auditability:

```
deploy/staging/2026-02-07T15-30-00Z/abc1234...
deploy/production/2026-02-07T16-00-00Z/abc1234...
deploy/staging/rollback/2026-02-07T17-00-00Z/abc1234...
```

To find the latest production deployment:
```bash
git tag --list 'deploy/production/*' --sort=-creatordate | head -1
```

## Per-Environment Builds

`NEXT_PUBLIC_*` variables are baked into the JS bundle at build time by Next.js. A single artifact cannot serve both staging and production. The pipeline builds separate environment-specific artifacts from the **same commit SHA**, verified by the CI gate.

## Vercel Project Architecture

Six separate Vercel projects — three for staging and three for production:

| Environment | Projects |
|---|---|
| Staging | `my-app-web-staging`, `my-app-admin-staging`, `my-app-landing-staging` |
| Production | `my-app-web`, `my-app-admin`, `my-app-landing` |

None are connected to git; all deployments are pushed from GitHub Actions via `vercel deploy --prebuilt --prod`. Each project serves a single environment, so only Production-scoped environment variables are needed (no Preview/Production scope splitting).

Two Vercel-specific settings are architecturally required on all six projects:

- **Root Directory** must be set to `apps/<app>` on each project. The CI/CD pipeline runs `vercel build` from the monorepo root (to avoid a [Turbopack path-doubling bug](https://github.com/vercel/next.js/issues/88579)), and Root Directory tells the `@vercel/next` builder which app to build.
- **Framework Preset** must be set to **Next.js**. Without it, Vercel's builder detects `@vercel/static-build` from the monorepo root and fails.

**Why separate staging projects instead of Vercel Preview deployments?** Previously, staging used Vercel's Preview deployment feature on shared projects. Each push to `main` created a new preview URL without invalidating the old one, while the staging Convex database was updated in-place. This caused stale preview deployments to serve outdated frontend code against a mutated backend. Dedicated staging projects eliminate this problem — each deploy replaces the previous one and provides a stable URL.

For setup instructions, see [deployment-runbook.md — Create Vercel Projects](./deployment-runbook.md#2b-create-vercel-projects).

## Convex Deployment

Convex deploys **before** frontend apps. Backend functions and schema must be live before app code that references them.

### Schema Migration Rules

- **Additive changes** (new tables, optional fields, indexes): safe to deploy directly
- **Breaking changes** (remove fields, change types): use two-phase deploy:
  1. Deploy backward-compatible Convex code (add new, keep old)
  2. Deploy frontend that uses new code
  3. Run data migration
  4. Deploy cleanup (remove old field)

### First-Time Initialization (Admin Bootstrap)

After the very first deployment, the Convex database is empty — no admin account exists. The `bootstrap` module (`packages/backend/convex/bootstrap.ts`) provides internal functions to seed the first admin without needing a UI:

- **`bootstrap:initialize`** — Seeds the admin email, creates a waitlist entry, and sends an invitation token. Can only run once.
- **`bootstrap:rescue`** — Fixes a failed bootstrap (typo, expired token). Revokes old tokens and resends. Cannot run after claim.
- **`bootstrap:status`** — Read-only diagnostic with actionable hints.

These are `internalMutation`/`internalQuery` — not callable from the client. Run them from the Convex dashboard or via `bunx convex run`. For step-by-step instructions, see [deployment-runbook.md — Bootstrap the First Admin](./deployment-runbook.md#step-2-bootstrap-the-first-admin).

For infrastructure setup, prerequisites, troubleshooting, and free tier limits, see [deployment-runbook.md](./deployment-runbook.md).

---

## Failure Modes & Inconsistent States

The pipeline can leave the system in a partially-deployed state in several scenarios. This section catalogs each one, its impact, and the correct response.

### Build Phase Failure

Only changed apps are built (`build-web`, `build-admin`, `build-landing` run conditionally). Both `deploy-convex` and `attest` depend on **all build jobs** completing (unchanged apps are skipped, not failed). If any build fails:

- `deploy-convex` is skipped (no backend change)
- All frontend deploys are skipped
- System remains on the previous version — **clean state, no inconsistency**
- **Action:** Fix the build error and push again (staging) or re-run the workflow (production)

### Convex Deployment Failure

`deploy-convex` runs after all builds succeed. All three frontend deploy jobs depend on it. If Convex deploy fails:

- All frontend deploys are skipped
- System remains on the previous version — **clean state, no inconsistency**
- **Action:** Check the deploy key is correct for the target environment. Convex deploy keys are scoped to a specific deployment. Re-run the workflow after fixing.

### The Convex-First Window

This is an **expected transient state**, not a bug. After `deploy-convex` completes, the three frontend deploys start in parallel. During this window (typically 30–90 seconds):

- Old frontend code talks to the new Convex backend
- If the Convex changes are **backward-compatible** (new functions, new tables, new optional fields) → no user impact
- If the Convex changes are **breaking** (removed a query, renamed a function, changed return shape) → users see errors until frontends deploy

**This is why Convex changes must always be backward-compatible with the currently-running frontend.** See [Schema Migration Safety](#convex-schema-migration-safety) for how to handle breaking changes safely.

### Partial Frontend Deployment

`deploy-web`, `deploy-admin`, and `deploy-landing` run as three independent parallel jobs. If one succeeds and another fails:

- The succeeded app is on the new version; the failed app stays on the old version
- The smoke test / post-deploy job is skipped (it `needs` all three)
- The deployment tag is **not** created
- **Impact:** Usually low. The three apps are independent — they share the same Convex backend but do not call each other. Users of the failed app stay on the old version, which is compatible with the new backend (see Convex-first window above).
- **Action:** Re-run the failed job from the GitHub Actions UI. If that doesn't work, trigger the rollback workflow for the previous good SHA.

### Smoke Test / Health Check Failure

All three apps deployed successfully, but the smoke test (staging) or health check (production) fails:

- All apps are on the new version — the deployment **completed**
- The deployment tag is **not** created (record/post-deploy depends on smoke test)
- The failure might be **transient** (cold start, CDN propagation delay) or **real** (broken deployment)
- **Action:** Manually verify the URLs. If transient, re-run the smoke test job. If actually broken, trigger the rollback workflow.

### Attestation Failure

The `attest` job runs in parallel with `deploy-convex` — both depend on the builds, but not on each other. Attestation failure does **not** block Convex deployment or frontend deploys.

- **Impact:** Supply-chain integrity only — no SLSA provenance for this run. Artifacts still have SHA256 checksums.
- **Action:** Investigate the Sigstore/attestation error and re-run if needed. This is not urgent for functionality.

### Summary

| Failure Point | System State | User Impact | Action |
|---|---|---|---|
| Build failure | Previous version (clean) | None | Fix and re-push |
| Convex deploy failure | Previous version (clean) | None | Fix deploy key, re-run |
| Convex-first window | New backend, old frontends (transient) | None if backward-compatible | Ensure backward compatibility |
| Partial frontend deploy | Mixed frontend versions | Low (apps are independent) | Re-run failed job or rollback |
| Smoke test failure | New version deployed, tag missing | Possibly broken | Verify URLs, rollback if needed |
| Attestation failure | Deployment proceeds normally | None (integrity gap) | Re-run attestation |

---

## Rollback Procedures

### How Rollback Works

The `cd-rollback.yml` workflow performs a **full rebuild and redeploy** from the target SHA:

1. Validates the confirmation string and checks for a prior deployment tag
2. Checks out the target SHA and rebuilds all 3 apps for the target environment
3. Deploys Convex backend from the target SHA (backend first, same as forward deploy)
4. Deploys all 3 apps to Vercel using the freshly-built artifacts
5. Runs health checks and creates a rollback tag: `deploy/<env>/rollback/<timestamp>/<sha>`

The rebuild-from-source approach means rollback works **regardless of artifact age**. Original artifacts may have expired (90-day retention), but git history is permanent.

**Concurrency:** The rollback workflow uses the same concurrency group (`deploy-<env>`) as normal deploys, so a rollback cannot collide with an in-progress deployment.

For step-by-step rollback instructions, see [deployment-runbook.md — Rollback](./deployment-runbook.md#7-rollback).

### When Rollback Cannot Work

Rollback can fail in these scenarios:

**Breaking Convex schema changes with incompatible data.** If the new code wrote data using a new schema (e.g., added a required field, changed a field type), rolling back to the old schema will fail because Convex validates the schema against existing data. The old schema may reject documents written by the new code.

Example: You added `phase: v.string()` as a required field and deployed. New documents were created with `phase`. Rolling back to the old schema (which doesn't have `phase`) may succeed if `phase` is not in the schema validator, but rolling back to a schema that expects a different structure will fail.

**Changed Vercel environment variables.** The rollback rebuilds from source and pulls environment variables from the Vercel dashboard (`vercel pull`). If those variables have changed since the target SHA was originally deployed (e.g., a Convex URL was updated), the rebuilt artifact will use the **current** variables, not the original ones.

**Removed external dependencies.** If the target SHA references an npm package version or external API that is no longer available, the rebuild will fail.

### Rollback vs. Roll-Forward Decision Matrix

| Scenario | Rollback? | Roll Forward? | Rationale |
|---|---|---|---|
| Simple bug, no schema changes | **Yes** | — | Fastest path to working state |
| Bug with additive schema changes (new table, optional field) | **Yes** | — | Additive changes are backward-compatible |
| Bug with breaking schema + data already migrated | — | **Yes** | Old schema may be incompatible with new data |
| Performance regression | **Yes** | — | Revert to last known-good state |
| Security vulnerability | **Yes** | — | Speed matters; patch forward after rollback |
| Data corruption from new code | — | **Yes** | Rolling back code doesn't undo data damage; need a fix |

---

## Convex Schema Migration Safety

This section expands on the [Schema Migration Rules](#schema-migration-rules) above with detailed procedures and examples.

### Safe Changes (Deploy Directly)

These changes are backward-compatible and can go through the normal deployment pipeline:

| Change | Why It's Safe |
|---|---|
| Add a new table | Old code doesn't reference it |
| Add an optional field (`v.optional(...)`) | Old code ignores it; old documents don't have it |
| Add a new index | Old code doesn't use it |
| Add a new Convex function (query/mutation/action) | Old frontend doesn't call it |
| Add a new literal to a `v.union()` (e.g., adding `"archived"` to status) | Old documents use existing literals; new literal is only written by new code |

### Breaking Changes (Require Migration Strategy)

These changes can cause failures if deployed directly:

| Change | Risk |
|---|---|
| Remove a table | Old frontend code referencing it will crash |
| Remove a field | Old frontend code reading it gets `undefined` |
| Add a **required** field | Old code doesn't write it; new documents from old code fail validation |
| Change a field type (e.g., `v.string()` → `v.number()`) | Existing data doesn't match new validator |
| Rename a field | Same as remove old + add new required |
| Remove a literal from `v.union()` | Existing documents with that literal fail validation |
| Remove a Convex function | Old frontend calling it gets a runtime error |

### Two-Phase Migration Pattern

Use this pattern for zero-downtime breaking changes. Example: renaming `status` to `phase` on the `launchItems` table.

**Current schema:**
```typescript
launchItems: defineTable({
  title: v.string(),
  status: v.union(v.literal("idea"), v.literal("building"), v.literal("shipping")),
  // ...other fields
})
```

**Phase 1 — Add new field, keep old (backward-compatible)**

```typescript
// schema.ts — Phase 1
launchItems: defineTable({
  title: v.string(),
  status: v.union(v.literal("idea"), v.literal("building"), v.literal("shipping")),
  phase: v.optional(v.union(v.literal("idea"), v.literal("building"), v.literal("shipping"))),
  // ...other fields
})
```

```typescript
// mutation — Phase 1: write both fields
export const create = mutation({
  args: { title: v.string(), phase: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("launchItems", {
      title: args.title,
      status: args.phase,  // old field (for old frontend)
      phase: args.phase,   // new field (for new frontend)
      // ...
    });
  },
});

// query — Phase 1: read from new field with fallback
export const list = query({
  handler: async (ctx) => {
    const items = await ctx.db.query("launchItems").collect();
    return items.map(item => ({
      ...item,
      phase: item.phase ?? item.status,  // prefer new field, fall back to old
    }));
  },
});
```

Deploy Phase 1 Convex + frontend. Both old and new frontends work.

**Data migration — Backfill existing documents**

```typescript
// One-off action to backfill phase from status
export const backfillPhase = action({
  handler: async (ctx) => {
    const items = await ctx.runQuery(internal.launchItems.listWithoutPhase);
    for (const item of items) {
      await ctx.runMutation(internal.launchItems.setPhase, {
        id: item._id,
        phase: item.status,
      });
    }
  },
});
```

Run via the Convex dashboard or CLI: `npx convex run launchItems:backfillPhase`

**Phase 2 — Remove old field (cleanup)**

```typescript
// schema.ts — Phase 2
launchItems: defineTable({
  title: v.string(),
  phase: v.union(v.literal("idea"), v.literal("building"), v.literal("shipping")),
  // status field removed
  // ...other fields
})
```

Deploy Phase 2 Convex + frontend. Remove all `status` references from code.

### When Rollback Is Impossible

After Phase 2 cleanup:
- The `status` field is gone from the schema
- Rolling back to pre-Phase-1 code expects `status` as a required field
- If `status` was actually removed from documents during migration, rollback fails

**Mitigation:** Keep Phase 1 deployed for a soak period (at least one full deployment cycle) before proceeding to Phase 2. Test rollback in staging before cleaning up in production. Once Phase 2 is deployed and stable, accept that rollback past Phase 1 is no longer possible.

---

## Downtime & Zero-Downtime Deployments

Most deployments require zero downtime:

- **Additive schema changes** — new tables, optional fields, new indexes, new functions
- **Frontend-only changes** — no Convex changes at all
- **Bug fixes** that don't change the data model
- **Breaking changes** — handled by the [Two-Phase Migration Pattern](#two-phase-migration-pattern) above

### Decision Matrix

| Change Type | Downtime? | Recommended Approach |
|---|---|---|
| New table / optional field | No | Direct deploy |
| New Convex function | No | Direct deploy |
| Rename a field | No | Two-phase migration |
| Remove a field with data | No | Two-phase migration |
| Change field type | No | Two-phase migration |
| Add required field | No | Two-phase migration (add as optional first) |
| Complete schema redesign | No (usually) | Extended two-phase migration |
| Merge/split tables | No (usually) | Two-phase migration |

---

## Artifact Retention & Recovery

### Artifact Lifecycle

GitHub Actions artifacts are retained for **90 days** (configured in `build-app/action.yml`). After 90 days:

- The tarball (`.tar.gz`) and checksum (`.sha256`) are deleted from GitHub
- The build manifest JSON is also deleted
- SLSA attestations remain in the GitHub attestation store (separate from artifact retention)
- **Git tags are permanent** and persist indefinitely in the repository

### Rollback Does Not Depend on Artifacts

The rollback workflow (`cd-rollback.yml`) **always rebuilds from source** at the target SHA. It never attempts to download old artifacts. This means rollback works at any point in the future, as long as:

- The git tag or SHA is known
- The Vercel environment variables are still valid
- The npm dependencies are still available in registries

### Finding Deployable SHAs

Git tags are the durable reference for identifying known-good deployment states:

```bash
# List recent production deployments
git fetch --tags
git tag --list 'deploy/production/*' --sort=-creatordate | head -10

# List recent staging deployments
git tag --list 'deploy/staging/*' --sort=-creatordate | head -10

# List all rollbacks
git tag --list 'deploy/*/rollback/*' --sort=-creatordate

# Get details of a specific deployment (shows workflow run URL)
git tag -v 'deploy/production/2026-02-07T16-00-00Z/abc1234...'

# Find all deployment tags for a specific SHA
git tag --list --points-at abc1234def5678 | grep deploy/
```

### Manual Artifact Recovery (Not Recommended)

It is technically possible to download artifacts from GitHub before they expire and store them externally (e.g., in an S3 bucket or a GitHub Release). To redeploy, you would upload the tarball and deploy with `vercel deploy --prebuilt`.

However, this is **error-prone and not recommended** because:
- The rebuild-from-source approach already handles expired artifacts
- Manual downloads risk version mismatches or corrupted files
- There's no automation around it, so it depends on someone remembering to do it

If artifact preservation is important for compliance or audit purposes, consider:
- Increasing the retention period (up to 400 days on GitHub Enterprise)
- Attaching artifacts to GitHub Releases for permanent storage
- Using the SLSA attestations (which persist independently) for provenance verification

---

## Alerting & Notifications

### GitHub Built-in Email Notifications (Enabled)

GitHub sends email notifications for failed workflow runs to repository watchers. This is enabled and serves as the baseline alerting mechanism.

**Configuration:** Repository Settings > Notifications > Actions

**Limitations:**
- Email only (no Slack, no PagerDuty)
- No granular filtering (all workflow failures, not just deployments)
- Can be noisy if CI also sends failure emails
- Delay depends on email delivery

### Slack Webhook Integration

Add a notification job to each CD workflow that fires on failure. Example implementation:

```yaml
# Add to cd-staging.yml, cd-production.yml, cd-rollback.yml
notify-failure:
  name: Notify Deployment Failure
  needs: [deploy-web, deploy-admin, deploy-landing]
  if: failure()
  runs-on: ubuntu-latest
  steps:
    - name: Send Slack notification
      uses: slackapi/slack-github-action@v2
      with:
        webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
        webhook-type: incoming-webhook
        payload: |
          {
            "text": ":red_circle: Deployment failed",
            "blocks": [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "*Deployment Failed*\n*Workflow:* ${{ github.workflow }}\n*SHA:* `${{ github.sha }}`\n*Run:* <${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View Run>"
                }
              }
            ]
          }
```

**Setup required:**
1. Create a Slack incoming webhook in your Slack workspace
2. Add `SLACK_WEBHOOK_URL` as a repository secret in GitHub
3. Add the `notify-failure` job to each CD workflow

### GitHub Deployments API

The pipeline already uses GitHub Environments, which tracks deployment status on the repository's Environments page. Third-party monitoring tools (Datadog, PagerDuty, Opsgenie) can poll the GitHub Deployments API for status changes.

```bash
# Check deployment status via API
gh api repos/{owner}/{repo}/deployments --jq '.[0:5] | .[] | "\(.environment) \(.sha[0:7]) \(.created_at)"'
```

### Recommendation

| Team Size | Approach |
|---|---|
| Solo / small team | GitHub email notifications (built-in, zero setup) |
| Team with Slack | Add Slack webhook to CD workflows |
| Production-critical | PagerDuty or Opsgenie integration via webhook |

