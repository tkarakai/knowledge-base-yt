import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

describe("rateLimits schema", () => {
  test("rateLimits table exists and accepts records", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("rateLimits", {
        name: "mutationGlobal",
        key: "user-123",
        value: 5,
        ts: Date.now(),
      });
    });

    const entries = await t.run(async (ctx) => {
      return ctx.db.query("rateLimits").collect();
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("mutationGlobal");
    expect(entries[0].key).toBe("user-123");
  });

  test("rateLimits table has name index", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("rateLimits", {
        name: "mutationGlobal",
        key: "user-a",
        value: 10,
        ts: Date.now(),
      });
      await ctx.db.insert("rateLimits", {
        name: "mutationGlobal",
        key: "user-b",
        value: 5,
        ts: Date.now(),
      });
    });

    const results = await t.run(async (ctx) => {
      return ctx.db
        .query("rateLimits")
        .withIndex("name", (q) => q.eq("name", "mutationGlobal").eq("key", "user-a"))
        .collect();
    });

    expect(results).toHaveLength(1);
    expect(results[0].key).toBe("user-a");
  });
});
