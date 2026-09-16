# Testing Guide

> Detailed guide for AI agents. See `CLAUDE.md` for the quick reference.

## When to Use Each Test Type

| Test Type | Framework | Use For | Location |
|-----------|-----------|---------|----------|
| Unit | Bun | Pure functions, utilities, helpers | `apps/*/qa/tests/*.test.ts` |
| Component | Vitest | React components, UI interactions | `apps/*/qa/tests/*.test.tsx` |
| E2E | Playwright | Full user flows, navigation, auth | `apps/*/qa/e2e/*.spec.ts` |
| Backend | convex-test | Convex functions (queries, mutations) | `packages/backend/convex/*.test.ts` |

## Bun Test Pattern (Utility Functions)

```typescript
// apps/web/qa/tests/myFunction.test.ts
import { describe, expect, it } from "bun:test";
import { myFunction } from "../../src/lib/myModule";

describe("myFunction", () => {
  it("handles happy path", () => {
    expect(myFunction("input")).toBe("expected");
  });

  it("handles edge cases", () => {
    expect(myFunction("")).toBe("default");
    expect(myFunction(null)).toBe("default");
  });
});
```

## Vitest Component Test Pattern

```typescript
// apps/web/qa/tests/button.test.tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "@repo/design-system";

describe("Button", () => {
  it("renders with text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("calls onClick handler", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Playwright E2E Test Pattern

```typescript
// apps/web/qa/e2e/homepage.spec.ts
import { expect, test } from "@playwright/test";

test.describe("Homepage", () => {
  test("loads and displays content", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Web App/);
    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("navigates to dashboard", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/dashboard"]');
    await expect(page).toHaveURL(/dashboard/);
  });
});
```

## Convex Backend Test Pattern

```typescript
// packages/backend/convex/launchItems.test.ts
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("launchItems", () => {
  test("returns items for authenticated user", async () => {
    // IMPORTANT: In monorepos, pass glob as second arg for module discovery
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));

    // Seed test data
    await t.run(async (ctx) => {
      await ctx.db.insert("launchItems", {
        title: "Test Item",
        description: "Description",
        status: "idea",
        priority: 1,
        ownerId: "test-user",
        createdAt: Date.now(),
      });
    });

    // Query and verify
    const items = await t.run(async (ctx) => {
      return ctx.db.query("launchItems").collect();
    });

    expect(items).toHaveLength(1);
  });
});
```

> **IMPORTANT**: In monorepos with hoisted `node_modules`, `convexTest()` needs the glob as its second argument: `convexTest(schema, import.meta.glob("./**/*.*s"))`. Without it, auto-discovery of Convex modules fails.

### Scheduled Functions and Fake Timers

When a Convex mutation calls `ctx.scheduler.runAfter()`, convex-test auto-executes the scheduled function via `setTimeout`. If the scheduled function is an `internalAction` that can't run in the test environment (e.g. it calls external APIs or uses features unavailable in tests), this causes unhandled rejection errors.

**Fix:** Use `vi.useFakeTimers()` to prevent `setTimeout` from firing. The scheduled function is still recorded but never executed.

```typescript
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

describe("myModule", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("mutation that schedules an action", async () => {
    const t = convexTest(schema, modules);
    // The mutation calls ctx.scheduler.runAfter() internally,
    // but fake timers prevent the scheduled action from running.
    await t.mutation(internal.myModule.myMutation, { arg: "value" });
  });
});
```

> **When to use this:** Only when the scheduled function can't run in tests. If the scheduled function is a simple mutation/query that works in convex-test, you don't need fake timers — let it run normally.

## Test Helpers

### Authentication Mocking (`apps/web/qa/tests/helpers/auth-mock.ts`)

```typescript
import { createMockUser, mockUseAuth, createMockAuthContext } from "../qa/tests/helpers/auth-mock";

// Create a mock user
const user = createMockUser({ name: "Test User", email: "test@example.com" });

// Mock the useAuth hook for component testing
const auth = mockUseAuth({ isAuthenticated: true, user });

// Create mock auth context for Convex testing
const authCtx = createMockAuthContext(user);
```

### Test Fixtures (`apps/web/qa/tests/fixtures/data.ts`)

```typescript
import {
  launchItemFixtures,
  createLaunchItem,
  createManyLaunchItems,
  scenarios,
} from "../qa/tests/fixtures/data";

// Use pre-defined fixtures
const items = scenarios.multiUser.launchItems;

// Create a custom fixture
const customItem = createLaunchItem({
  title: "My Custom Item",
  status: "building",
  priority: 2,
});

// Bulk create for pagination testing
const manyItems = createManyLaunchItems(50, "owner-id");
```

### Visual Regression (`apps/web/qa/tests/helpers/visual-regression.ts`)

```typescript
import {
  expectPageSnapshot,
  expectResponsiveSnapshot,
  expectElementSnapshot,
  fullVisualTest,
} from "../qa/tests/helpers/visual-regression";

// Full page screenshot comparison
await expectPageSnapshot(page, "homepage");

// Responsive viewport testing
await expectResponsiveSnapshot(page, "dashboard", "mobile");
await expectResponsiveSnapshot(page, "dashboard", "tablet");
await expectResponsiveSnapshot(page, "dashboard", "desktop");

// Element-specific screenshot
const button = page.getByRole("button", { name: "Submit" });
await expectElementSnapshot(button, "submit-button");

// Full visual test (multiple viewports and themes)
await fullVisualTest(page, "settings-page", {
  viewports: ["mobile", "desktop"],
  themes: ["light", "dark"],
});
```

## TDD Workflow

### Recommended Approach

1. **Understand the requirement** - Read related files and understand context
2. **Write a failing test first** - Define expected behavior
3. **Implement minimal code** - Make the test pass
4. **Refactor** - Improve code while tests still pass
5. **Run all tests** - Ensure no regressions

### Quick Feedback Loop

```bash
# For utility functions (fastest, from apps/web/)
bun run test --watch

# For React components (from apps/web/)
bun run test:watch

# For full integration (from root)
bun run test:all
```

### Example TDD Session

```bash
# 1. Create test file
# apps/web/qa/tests/newFeature.test.ts

# 2. Run in watch mode (from apps/web/)
bun run test:watch

# 3. Write test, see it fail (red)
# 4. Implement code, see it pass (green)
# 5. Refactor with confidence
```

## Task Division

| Task Type | Recommended Approach |
|-----------|---------------------|
| **Research** | Read files, grep patterns, understand codebase |
| **Unit Test** | Create test in `apps/<app>/qa/tests/`, implement function, verify with `bun run test` |
| **Component** | Create test in `apps/<app>/qa/tests/`, implement component, verify with Vitest |
| **E2E Flow** | Create spec in `apps/<app>/qa/e2e/`, implement, verify with Playwright |
| **Convex Function** | Define in `packages/backend/convex/schema.ts`, implement handler, test with convex-test |
| **Shared UI** | Add component in `packages/design-system/src/`, export from index.ts |

## Context Boundaries

- Each file should be self-contained with clear imports
- Use `@repo/` for cross-package imports, `@/` for app-internal imports
- Document public APIs with JSDoc comments
- Keep component files under 200 lines
