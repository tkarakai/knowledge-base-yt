# Convex Migrations

How to safely change database schemas when existing data doesn't match the new shape.

## Background

Convex validates **ALL existing documents** against the schema on every deploy. If any document doesn't match, **the deployment fails** — no functions run, no migration code executes.

Unlike Rails, Django, Prisma, or Flyway, **Convex has no built-in migration runner** — there is no "run pending migrations before startup" step. This is a genuine limitation. We compensate by:

1. Using the migration framework from `convex-helpers` (already wired up in this project)
2. Running migrations automatically after every deploy in CI/CD

## When You Need a Migration

**No migration needed** — just change schema and deploy:
- Adding a new **optional** field
- Adding a new **table**
- Removing an **optional** field
- Widening a type (e.g. `v.string()` to `v.union(v.string(), v.number())`)

**Migration needed** — existing documents would fail validation:
- Adding a new **required** field
- Removing a **required** field
- Renaming a field
- Changing a field's type

## How It Works

Breaking schema changes require **two PRs**. The core idea: first make the schema accept both old and new shapes ("widen"), then after all environments have been migrated, tighten the schema back ("narrow").

**Migrations run automatically** on every deploy and every `bun run dev` startup. The deploy-convex CI/CD action and dev-start.sh both run `npx convex run migrations` after Convex is ready. You never need to run migration commands manually.

**Two rules:**

1. **Don't merge the narrow PR** until the widen PR has been deployed to **all** environments (including production). See [why this matters](#why-the-ordering-rule-matters) below.
2. **Every migration must be idempotent.** Because migrations run on every deploy and every dev startup, your `migrateOne` function will be called on documents that have already been migrated. It must be safe to run repeatedly — check the document's current state before modifying it. The framework tracks completion state and skips finished migrations, but if a migration is interrupted mid-batch and restarted, some documents in the last batch may be processed twice.

### Why the ordering rule matters

The narrow PR tightens the schema — it makes fields required, removes old fields, etc. If production still has old documents that haven't been migrated, the narrowed schema will reject them and **the production deploy will fail**.

Here's what goes wrong if you merge the narrow PR too early:

```
PR 1: Widen schema + migration       (merged to main)
  → Staging deploys, migration runs   ✓ staging is fine

PR 2: Narrow schema                   (merged to main BEFORE prod deploy)
  → Staging deploys                   ✓ staging is fine (already migrated)

Promote to production...
  → Convex tries to deploy the NARROWED schema
  → Production still has old documents (never migrated!)
  → Schema validation fails: "document missing required field 'displayName'"
  → ✖ PRODUCTION DEPLOY BLOCKED
```

The problem: staging got both PRs deployed sequentially (widen → migrate → narrow), so it worked. But production skipped straight to the narrowed schema without ever running the migration, because **the widen PR was never deployed to production**.

The safe sequence:

```
PR 1: Widen schema + migration       (merged to main)
  → Staging deploys, migration runs   ✓

Promote to production                 (deploy the widen PR)
  → Production deploys, migration runs ✓

PR 2: Narrow schema                   (NOW safe to merge)
  → Staging deploys                   ✓

Promote to production
  → Production deploys                ✓ all documents already migrated
```

### If production broke because the narrowed schema reached it before data was migrated

If production deploy fails with a schema error like these:

- `Schema validation failed`
- `Document ... missing required field ...`

Use this hotfix sequence:

1. Create a hotfix branch from `main`.
2. Re-widen the schema immediately in `packages/backend/convex/schema.ts`:
   - Required field added too early: make it `v.optional(...)`.
   - Field type changed too early: use `v.union(oldType, newType)`.
   - Field removed too early: add it back as optional.
3. Restore backward-compatible Convex function behavior if needed:
   - Reads: `newField ?? oldField`.
   - Writes: include the old field until migration completes.
4. Ensure the migration still exists in `packages/backend/convex/migrations.ts` and is still listed in `startMigrationsSerially(...)`.
5. Merge the hotfix to `main` with expedited review.
6. Let staging deploy, then promote that hotfix SHA to production.
7. Confirm the production deploy passes and migrations run.
8. Keep schema widened until all environments are migrated, then do the normal narrow PR.

If widening a single table cannot represent both old and new document shapes, use the temporary global escape hatch (`schemaValidation: false`) described in [Last Resort: Schema Validation Escape Hatch](#last-resort-schema-validation-escape-hatch), then follow up with a second PR to re-enable validation.

## Batching Features Before a Production Release

If you develop many features on staging before releasing them all to production at once, migrations add ordering constraints you need to manage carefully.

### The simple case: no migrations

Features without schema migrations (adding optional fields, new tables, etc.) need no special handling. Merge them whenever, deploy to production whenever.

### When some features have migrations

Say you're developing features 1 through 5 over several weeks, all going to staging, but releasing to production as one batch. Features 1 and 3 need two-stage migrations (widen + narrow). Features 2, 4, and 5 don't.

**The rule: all narrow PRs must be merged LAST, after production has been deployed with all the widen PRs.**

Here's the timeline:

```
Feature 1: PR 1a (widen + migration)  → merge to main, staging deploys ✓
Feature 2: PR 2  (no migration)       → merge to main, staging deploys ✓
Feature 3: PR 3a (widen + migration)  → merge to main, staging deploys ✓
Feature 4: PR 4  (no migration)       → merge to main, staging deploys ✓
Feature 5: PR 5  (no migration)       → merge to main, staging deploys ✓

Feature 1: PR 1b (narrow)             → DO NOT MERGE YET
Feature 3: PR 3b (narrow)             → DO NOT MERGE YET

   All features are on staging. Staging has widened schemas for 1 and 3,
   migrations have run, everything works.

Ready to release? Deploy everything to production:

Promote to production                  → deploys all merged PRs (1a, 2, 3a, 4, 5)
                                       → migrations run automatically ✓
                                       → production data migrated ✓

NOW merge the narrow PRs:

Feature 1: PR 1b (narrow)             → merge to main, staging deploys ✓
Feature 3: PR 3b (narrow)             → merge to main, staging deploys ✓

Promote to production again            → deploys narrow PRs ✓ (data already migrated)
```

### What to watch out for

**Narrow PRs can conflict with each other.** If features 1 and 3 both touch `schema.ts`, their narrow PRs may have merge conflicts. This is normal — resolve them like any other conflict. But be aware:

- **Don't let a narrow PR accidentally undo another feature's widening.** If feature 1's narrow PR was branched before feature 3's widen PR was merged, it might have a stale version of `schema.ts` that removes feature 3's widened fields. Always rebase narrow PRs against `main` before merging.
- **Review narrow PRs together.** Since they all touch `schema.ts` and all need to be merged in the same window, review them as a batch to catch conflicts early.

**The widened schema is safe to run on for weeks.** There's no urgency to merge narrow PRs. The widened schema is just more permissive — application code handles both shapes, and new documents are written in the new shape. If you never narrow, things still work. Narrowing is a cleanup step, not a correctness requirement.

### The release pressure problem

Every two-stage migration creates a narrow PR that **cannot be merged until production catches up**. As you accumulate migrations over weeks of development, the pile of blocked narrow PRs grows. This creates increasing pressure to release to production — not because a feature is ready, but because you need to unblock your schema cleanup.

This is a real operational cost of Convex's migration model. Be aware of it.

### Recommended workflow

1. Label widen PRs with `migration:widen` and narrow PRs with `migration:narrow`
2. Merge all widen PRs as part of normal feature development
3. Keep narrow PRs open, rebased against `main`, but don't merge them
4. When you're ready for a production release:
   - Promote to production (widen PRs deploy, migrations run)
   - Verify production
   - Merge all narrow PRs at once (or batch them into a single PR)
   - Promote to production again (narrow PRs deploy)
5. If you forget to merge the narrow PRs — nothing breaks. The schema is just wider than it needs to be. You can narrow in the next release cycle.

## Step-by-Step Example

Scenario: rename a required field from `name` to `displayName` in the `users` table.

### PR 1: Widen + Migrate

One branch, one PR containing three changes:

**1. Widen the schema** (`convex/schema.ts`):

```diff
 users: defineTable({
-  name: v.string(),
+  name: v.optional(v.string()),         // was required — make optional
+  displayName: v.optional(v.string()),   // new field — optional until migration runs
   email: v.string(),
 }),
```

Both old documents (have `name`, no `displayName`) and new documents (have `displayName`, no `name`) now pass validation.

**2. Update Convex functions** (`convex/*.ts`) to handle both shapes:

```ts
// Queries — read from new field, fall back to old
const displayName = doc.displayName ?? doc.name ?? "Unknown";

// Mutations — always write the new field going forward
await ctx.db.insert("users", { displayName: args.name, email: args.email });
```

Only Convex function code changes here. Frontend app code doesn't need to change — your queries still return the same data to the client.

**3. Add the migration** (`convex/migrations.ts`):

```ts
export const renameUserName = migration({
  table: "users",
  migrateOne: async (ctx, doc) => {
    if (doc.name && !doc.displayName) {
      await ctx.db.patch(doc._id, {
        displayName: doc.name,
        name: undefined,
      });
    }
  },
});

// Add to the serial runner at the bottom of the file:
export default internalMutation(async (ctx) => {
  await startMigrationsSerially(ctx, [
    // ... existing migrations ...
    internal.migrations.renameUserName,
  ]);
});
```

**Commit, push, open PR, review, merge to `main`.**

What happens automatically after merge:
```
merge to main
  → cd-staging.yml triggers
    → deploy-convex action deploys schema + functions to staging
    → deploy-convex action runs `npx convex run migrations` ← automatic!
    → staging data is migrated
```

When you're ready to go to production:
```
trigger cd-production.yml (manual)
  → deploy-convex action deploys schema + functions to production
  → deploy-convex action runs `npx convex run migrations` ← automatic!
  → production data is migrated
```

### The Gap Between PRs

After PR 1 is deployed but before PR 2 is merged, everything works correctly:

- **Staging**: Widened schema deployed, migration has run, all documents have new shape
- **Production** (if not yet promoted): Still on old schema — unaffected
- **Production** (after promotion): Widened schema deployed, migration has run

You can merge other PRs during this time. The widened schema is not broken — it's just temporarily more permissive than it needs to be.

### PR 2: Narrow

Create this PR **only after production has been deployed with PR 1**.

**1. Tighten the schema** (`convex/schema.ts`):

```diff
 users: defineTable({
-  name: v.optional(v.string()),
-  displayName: v.optional(v.string()),
+  displayName: v.string(),
   email: v.string(),
 }),
```

**2. Remove the fallback logic** from Convex functions (`convex/*.ts`):

```diff
- const displayName = doc.displayName ?? doc.name ?? "Unknown";
+ const displayName = doc.displayName;
```

**Commit, push, open PR, review, merge to `main`.** Deploy to staging, then production as usual. No migration needed — all documents already conform.

## Complete Timeline

```
PR 1: Widen schema + migration + backwards-compatible Convex functions
  ├─ Merge to main
  ├─ Staging deploys automatically (schema + migration run by CI)
  │
  │   ... you can merge other PRs here, do other work ...
  │
  ├─ Promote to production (manual trigger)
  │   Production deploys (schema + migration run by CI)
  │
  │   ✓ All environments migrated. Safe to narrow.
  │
PR 2: Narrow schema + remove fallback code from Convex functions
  ├─ Merge to main
  ├─ Staging deploys automatically
  ├─ Promote to production
  └─ Done
```

## Writing Migration Functions

Migrations live in `convex/migrations.ts`. The file is already set up with the `convex-helpers` framework.

**Every migration MUST be idempotent.** Migrations run on every deploy and every `bun run dev`. The framework skips completed migrations, but if a migration is interrupted and restarted, some documents may be processed twice. Always check the document's current state before modifying it.

To add a new migration:

**1. Define it:**

```ts
export const myMigration = migration({
  table: "tableName",
  migrateOne: async (ctx, doc) => {
    // Option A: return a partial object to patch the document
    // IMPORTANT: check current state first — this may run twice on the same doc
    if (!doc.newField) {
      return { newField: "default" };
    }

    // Option B: use ctx.db directly for complex operations
    if (!doc.newField) {
      await ctx.db.patch(doc._id, { newField: computeValue(doc) });
    }

    // Option C: delete the document (db.delete is inherently idempotent
    // within a single run — the framework won't revisit deleted docs)
    await ctx.db.delete(doc._id);
  },
});
```

**Idempotency checklist:**
- Does `migrateOne` check if the document already has the new shape before patching? (e.g. `if (!doc.newField)`)
- If the migration deletes documents, is there a condition to identify which ones? (don't blindly delete everything in the table)
- If the migration calls external services or inserts into other tables, would a second call create duplicates?

**2. Add it to the serial runner** (the `default` export at the bottom of the file):

```ts
export default internalMutation(async (ctx) => {
  await startMigrationsSerially(ctx, [
    internal.migrations.existingMigration,
    internal.migrations.myMigration,  // new ones go at the end
  ]);
});
```

That's it. CI/CD runs it automatically on the next deploy.

**Manual runs** (for dev or debugging):

```bash
# All pending migrations
npx convex run migrations

# Single migration
npx convex run migrations:myMigration '{"fn":"migrations:myMigration"}'

# Dry run — runs one batch then rolls back
npx convex run migrations:myMigration '{"fn":"migrations:myMigration","dryRun":true}'
```

The framework processes 100 documents per batch, tracks progress in the `migrations` table, and resumes from where it left off if interrupted.

## Dev Environment

For local development, you rarely need migrations. Just clear the database:

```bash
cd packages/backend && npx convex dev --once --configure=new
```

Or delete specific records from the Convex dashboard.

## Last Resort: Schema Validation Escape Hatch

If the old and new shapes are so different that no widened schema can accept both, you can temporarily disable schema validation entirely:

```ts
export default defineSchema(
  { /* tables */ },
  { schemaValidation: false },
);
```

This disables validation for **ALL tables globally**. Same two-PR pattern applies, but instead of widening individual fields, you disable validation entirely in PR 1 and re-enable it in PR 2.

## Quick Reference

| Scenario | Strategy | PRs |
|----------|----------|-----|
| Add optional field | Just add it | 1 |
| Add required field | Widen (optional) → migrate (set value) → narrow (required) | 2 |
| Remove required field | Widen (make optional) → migrate (clear) → narrow (remove) | 2 |
| Rename field | Widen (both optional) → migrate (copy + delete) → narrow (new only) | 2 |
| Change field type | Widen (union) → migrate (convert) → narrow (new type) | 2 |
| Delete old records | Widen (accept both) → migrate (delete) → narrow (new only) | 2 |
| Clear dev database | `cd packages/backend && npx convex dev --once --configure=new` | 0 |
