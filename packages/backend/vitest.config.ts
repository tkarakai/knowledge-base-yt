import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["convex/**/*.test.ts"],
    env: {
      SITE_URL: "http://localhost:3001",
      ADMIN_SITE_URL: "http://localhost:3002",
      LANDING_URL: "http://localhost:3000",
    },
    server: {
      deps: {
        inline: [/convex-test/],
      },
    },
  },
});
