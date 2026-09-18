## Convex CLI Operations

### Check Version

```bash
bunx convex --version
```

### Update

```bash
bun update convex
```

To specific version:

```bash
bun add convex@1.31.7
```

### Upgrade Convex Backend (Anonymous Mode)

When `bun dev` fails with:
```
This deployment is using an older version of the Convex backend. Upgrade now?
✖ Cannot prompt for input in non-interactive terminals.
```

**Fix (run from repo root):**

```bash
cd packages/backend && CONVEX_AGENT_MODE=anonymous bunx convex dev --once && cd ../..
```

It will prompt to upgrade and optionally transfer data. Say yes to both.

**Why this specific command:**

1. **`cd packages/backend`** — Critical. The dev script (`dev-start.sh`) starts Convex
   from `packages/backend/`, which has its own `.env.local` with its own
   `CONVEX_DEPLOYMENT`. Running from the repo root upgrades the wrong deployment
   (the root `.env.local` points to a different anonymous instance).

2. **`CONVEX_AGENT_MODE=anonymous`** — Required. Without this, the CLI detects your
   Convex login session and tries to link the anonymous deployment to your account,
   which fails with "deployment is not linked with your account". This env var tells
   the CLI to stay in anonymous mode and skip account validation.

3. **`bunx convex dev --once`** — Runs the Convex dev server once (no watch mode).
   This gives the CLI an interactive terminal where it can show the upgrade prompt,
   unlike `bun dev` which runs Convex in a background subprocess with stdout piped
   to a log file.

**Two `.env.local` files to be aware of:**

| File | Deployment | Used by |
|------|------------|---------|
| `.env.local` (repo root) | `anonymous:<agent-id-A>` | Next.js apps (NEXT_PUBLIC_CONVEX_URL) |
| `packages/backend/.env.local` | `anonymous:<agent-id-B>` | `convex dev` (the actual backend) |

> **Note**: These are **two different** anonymous deployments with different agent IDs (e.g., `anonymous:anonymous-agent-1` vs `anonymous:anonymous-agent-677ff109`). Check your actual `.env.local` files for the real values.

The dev script keeps these in sync at runtime (reads ports from backend state and
writes them to the root `.env.local`), but the **upgrade must target the backend one**.

### Common Commands

| Command | Description |
|---------|-------------|
| `bunx convex dev` | Start dev server (watches for changes) |
| `bunx convex dev --once` | One-time push without watching |
| `bunx convex dev --clear` | Clear all data and restart |
| `bunx convex deploy` | Push to production |
| `bunx convex dashboard` | Open web dashboard |
| `bunx convex logs` | View function logs |
| `bunx convex run module:fn '{}'` | Run a function from CLI |
| `bunx convex import --table name data.json` | Import data |
| `bunx convex export --path ./backup` | Export data |

### Authentication

```bash
bunx convex login      # Log in to Convex
bunx convex logout     # Log out
bunx convex switch     # Switch deployment
bunx convex env        # View current deployment info
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend version mismatch / cannot prompt in non-interactive | See [Upgrade Convex Backend](#upgrade-convex-backend-anonymous-mode) above |
| "deployment is not linked with your account" | Add `CONVEX_AGENT_MODE=anonymous` before the command |
| Upgraded but `bun dev` still fails with same error | You upgraded from the wrong directory — must `cd packages/backend` first |
| Schema validation errors | Check `convex/schema.ts` for issues |
| Functions not updating | Restart with `bunx convex dev` |
| Authentication issues | `bunx convex logout && bunx convex login` |
