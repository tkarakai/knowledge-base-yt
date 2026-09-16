# Development Workflow

> Detailed guide for AI agents. See `CLAUDE.md` for the quick reference.

## Starting Development

```bash
# Start core apps + Convex (recommended)
bun run dev                  # Uses scripts/dev-start.sh

# Start a specific app + Convex
bun run dev:web              # Convex + web app (port 3001)
bun run dev:admin            # Convex + admin app (port 3002)
bun run dev:landing          # Landing only (port 3000, no Convex needed)
bun run dev:landing-static   # Static landing page (port 3004, no Convex)
bun run dev:storybook        # Component storybook only (port 3003, no Convex)

# Check service status
bun run dev:status           # Shows running processes

# Stop all services
bun run dev:stop
```

> **Note**: Do NOT use `turbo dev` directly. The custom `dev-start.sh` script handles Convex setup, port management, and environment configuration.

### Dev Seed Accounts

On first startup, `dev-start.sh` automatically creates two test accounts via `packages/backend/convex/devSeed.ts`:

| Email | Password | Role |
|-------|----------|------|
| `admin@admin.com` | email pasted x 3 | admin |
| `user@user.com` | email pasted x 3 | user |

The seed is gated behind the `DEV_SEED_ENABLED` Convex env var (set automatically by `dev-start.sh`) and is idempotent — it skips if the accounts already exist. To re-seed after a database reset, just restart `bun run dev`.

## Testing Commands (Detailed)

> **CRITICAL**: Always use `bun run test` (with `run`), never bare `bun test`.
> Bare `bun test` picks up ALL test files and fails because some require Vitest's DOM environment.

All test commands run via Turborepo from the project root:

```bash
# Bun Tests (fast, for utility functions)
bun run test                 # Run all Bun unit tests across workspaces

# Vitest Tests (React components with DOM)
bun run test:unit            # Run Vitest once (apps/web)
bun run test:watch           # Watch mode for development (run from apps/web)

# Convex Tests (backend functions)
bun run test:convex          # Run Convex backend tests (packages/backend)

# Playwright E2E Tests
bun run test:e2e             # Run all E2E tests

# Run everything
bun run test:all             # Bun + Vitest + Convex + Playwright
```

To run tests for a specific workspace directly:

```bash
# From apps/web/
cd apps/web
bun run test                 # Bun unit tests for web app
bun run test:unit            # Vitest component tests
bun run test:e2e             # Playwright E2E

# From packages/backend/
cd packages/backend
bun run test:convex          # Convex backend tests
```

## Build and Lint

```bash
bun run build                # Production build (all apps via Turborepo)
bun run lint                 # ESLint (all packages via Turborepo)
bun run typecheck            # TypeScript check (all packages via Turborepo)
```

## Debugging

### Common Issues

**Tests not finding modules:**
```bash
# Check path aliases match tsconfig.json
bun run typecheck
```

**Vitest configuration errors:**
```bash
# Run from the specific app directory
cd apps/web && bunx vitest --version
cd apps/web && bunx vitest run --reporter=verbose
```

**Playwright browser not installed:**
```bash
npx playwright install chromium
```

**Convex sync issues:**
```bash
# Restart the dev environment
bun run dev:stop && bun run dev:web
```

**convex-test module discovery fails in monorepo:**
```bash
# Ensure you pass the glob as second arg to convexTest()
# convexTest(schema, import.meta.glob("./**/*.*s"))
```
