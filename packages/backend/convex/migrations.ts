/**
 * Database migrations using the convex-helpers migration framework.
 *
 * ## How it works
 *
 * Each migration is defined with `makeMigration` which provides batching,
 * cursor-based pagination, resume-on-failure, and state tracking via the
 * `migrations` table in the schema.
 *
 * ## Running migrations
 *
 * ```bash
 * # Run all pending migrations in order (dev)
 * npx convex run migrations
 *
 * # Run all pending migrations in order (production)
 * npx convex run migrations --prod
 * ```
 *
 * ## Adding new migrations
 *
 * 1. Define the migration with `migration({ table, migrateOne })`
 * 2. Export it (name = CLI identifier)
 * 3. Add it to the `startMigrationsSerially` list in the default export
 *
 * For the full migration workflow (widen/migrate/narrow), see `docs/convex-migrations.md`.
 *
 * @module
 */
import { startMigrationsSerially } from "convex-helpers/server/migrations";

import { internalMutation } from "./_generated/server";

// ---------------------------------------------------------------------------
// Default export: run all pending migrations in series.
// `npx convex run migrations` calls this.
// ---------------------------------------------------------------------------

export default internalMutation(async (ctx) => {
  await startMigrationsSerially(ctx, [
    // Add future migrations here, in order.
  ]);
});
