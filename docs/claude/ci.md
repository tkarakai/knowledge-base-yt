# CI Guide

> Detailed guide for AI agents. See `CLAUDE.md` for the quick reference.

## Local CI (Pre-Push Checks)

Run the same checks that GitHub Actions CI runs before pushing:

```bash
bun run ci                   # Full CI check (runs everything)
bun run ci:quick             # Skip E2E tests for faster feedback
```

The `bun run ci` command runs these checks in order (all via `turbo`):
1. **TypeScript check** (`turbo typecheck`)
2. **ESLint** (`turbo lint`)
3. **Bun unit tests** (`turbo test`)
4. **Vitest component tests with coverage** (`turbo test:coverage`)
5. **Coverage summary display** + artifact saving
6. **Convex backend tests** (`turbo test:convex`)
7. **Production build** (`turbo build`)
8. **Bundle size check** (all apps with `.size-limit.json`)
9. **Storybook build** (`turbo build --filter=@repo/storybook...`)
10. **Playwright E2E tests** (requires `bun run dev` running in another terminal)

Artifacts (coverage reports, Playwright reports, visual snapshots, dev logs) are saved to `.ci-local-artifacts/` for local inspection.

Use `bun run ci:quick` to skip E2E tests when you need faster feedback. The script will exit on the first failure with a clear error message.

> **Note**: E2E tests require the dev environment (`bun run dev`) to be running. The CI script checks that servers are reachable before running Playwright tests and prints a clear error if they are not.

> **Note**: Security checks (CodeQL, dependency audit, secrets scan), Lighthouse audits, and CI gate are only run in GitHub Actions CI, not locally.

## Running GitHub Actions Locally with `act`

[act](https://github.com/nektos/act) runs GitHub Actions workflows locally in Docker containers:

```bash
# Install act (requires Docker)
brew install act

# Run all CI workflows
bun run ci:act                # Full output + summary
bun run ci:act:quick          # Quiet mode, summary only
bun run ci:act:offline        # Offline mode (after caches are populated)

# Run a specific workflow
./scripts/ci-local-act.sh -w shared    # Just lint + backend tests
./scripts/ci-local-act.sh -w web       # Just web app CI
./scripts/ci-local-act.sh -w admin     # Just admin app CI
./scripts/ci-local-act.sh -w landing   # Just landing app CI
./scripts/ci-local-act.sh -w storybook # Just storybook app CI

# Run a specific job
./scripts/ci-local-act.sh -j lint      # Just linting
./scripts/ci-local-act.sh -l           # List available jobs
./scripts/ci-local-act.sh -o           # Offline mode
```

**CI is split into 5 independent workflows** that `ci-local-act.sh` runs sequentially:
1. `ci-shared.yml` — Lint, typecheck, backend tests (shared across all packages)
2. `ci-web.yml` — Web app: unit tests, component tests, build, bundle size, E2E
3. `ci-admin.yml` — Admin app: same checks as web
4. `ci-landing.yml` — Landing app: same checks (no Convex dependency)
5. `ci-storybook.yml` — Storybook app: build, E2E (non-blocking, not required for merge)

Each workflow uses **composite actions** (`.github/actions/setup-bun`, `.github/actions/setup-playwright`) for shared setup steps, handling both GitHub Actions and act-specific cache-aware setup automatically.

**Configuration**: `.actrc` uses native ARM64 containers on Apple Silicon (no emulation) and bind-mount mode (`-b`) to make composite actions visible to act.

**When to use which**:
- `bun run ci` — Fast native checks, no Docker required
- `bun run ci:act` — Full GitHub Actions simulation in Docker
- `bun run ci:act:offline` — Fast offline execution (no network required)

## Offline CI Mode (act)

### Rationale

Running CI tests locally should be fast and not require internet access for every run. When you're iterating on code without changing dependencies, there's no need to re-download tools, packages, or browser binaries. Offline mode enables:

1. **Fast iteration** — Skip network downloads on subsequent runs
2. **Airplane mode development** — Work without internet connectivity
3. **Reduced bandwidth** — Don't re-download the same artifacts repeatedly
4. **Consistent environments** — Use the exact same cached binaries across runs

### How It Works

The `ci-local-act.sh` script uses **Docker volumes** to persist downloaded artifacts between runs:

| Volume Name | Container Path | Contents |
|-------------|----------------|----------|
| `act-bun-cache` | `/root/.bun` | Bun binary + package cache (node_modules) |
| `act-playwright-cache` | `/root/.cache/ms-playwright` | Chromium browser binaries |
| `act-toolcache` | `/opt/act-toolcache` | Node.js installations |

**First run (online):** Downloads and caches everything to Docker volumes
**Subsequent runs:** Uses cached artifacts from volumes (fast, works offline)

### Usage

```bash
# First run: populate caches (requires internet)
bun run ci:act

# Subsequent runs: use offline mode (no internet required)
bun run ci:act:offline
```

The offline flag (`-o`) adds:
- `--pull=false` — Don't pull Docker images
- `--action-offline-mode` — Don't fetch GitHub Actions

### Pattern for Adding New Tools

When introducing a new tool that downloads from the internet, create a **composite action** in `.github/actions/<tool-name>/action.yml`:

```yaml
name: 'Setup ToolName'
runs:
  using: 'composite'
  steps:
    # Standard GitHub Actions (uses official setup action)
    - name: Setup ToolName
      if: ${{ !env.ACT }}
      uses: vendor/setup-toolname@v1
      with:
        version: "1.2.3"

    # act offline mode (checks cache first, downloads if needed)
    - name: Setup ToolName (act)
      if: ${{ env.ACT }}
      shell: bash
      run: |
        TOOL_DIR="/path/to/cache"
        if [ -x "$TOOL_DIR/bin/tool" ]; then
          echo "Tool already installed"
        else
          curl -fsSL https://example.com/install.sh | bash
        fi
        echo "$TOOL_DIR/bin" >> $GITHUB_PATH
```

Then use it in any workflow job:
```yaml
steps:
  - uses: ./.github/actions/setup-toolname
```

**Key principles:**
1. Use composite actions to avoid duplicating setup across workflows
2. Use `if: ${{ !env.ACT }}` for standard GitHub Actions setup steps
3. Use `if: ${{ env.ACT }}` for act-specific cache-aware setup
4. Check if the tool exists before downloading
5. Install to a path that's mounted as a Docker volume
6. Add the tool to `$GITHUB_PATH`

### Currently Cached Tools

| Tool | Cache Location | Setup Pattern |
|------|----------------|---------------|
| Bun | `/root/.bun/bin/bun` | Custom script checks existence |
| Node.js | `/opt/act-toolcache/node/` | `setup-node` respects `RUNNER_TOOL_CACHE` |
| Playwright | `/root/.cache/ms-playwright/` | Volume persists browser binaries |
| npm packages | `/root/.bun/install/cache/` | Bun's package cache |

### Troubleshooting

**Cache issues (tar errors):** The `actions/cache` step is skipped in act (`if: ${{ !env.ACT }}`) because multiple parallel jobs sharing the same volume causes race conditions. Docker volumes provide persistence instead.

**Tool not found offline:** Run `bun run ci:act` once online to populate caches.

**Clearing caches:** Remove Docker volumes to start fresh:
```bash
docker volume rm act-bun-cache act-playwright-cache act-toolcache
```
