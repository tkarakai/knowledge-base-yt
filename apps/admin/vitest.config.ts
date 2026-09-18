import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  cacheDir: resolve(__dirname, "node_modules/.vite"),
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./qa/tests/setup.ts"],
    include: ["qa/tests/**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    pool: "forks",
    poolOptions: {
      forks: {
        isolate: true,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html", "lcov"],
      reportsDirectory: "./qa/coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "**/node_modules/**",
        "**/types/**",
      ],
      thresholds: {
        lines: 0,
        branches: 0,
        functions: 0,
        statements: 0,
        autoUpdate: false,
      },
    },
  },
});