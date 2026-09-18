import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { getGitBranch } from "@repo/design-system/build-utils";

const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const gitBranch = getGitBranch();

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "production" ? "export" : undefined,
  trailingSlash: true,
  reactStrictMode: true,
  env: {
    ...(gitBranch ? { NEXT_PUBLIC_GIT_BRANCH: gitBranch } : {}),
  },
  transpilePackages: ["@repo/design-system", "@repo/design-patterns", "@repo/i18n"],
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
};

export default withNextIntl(nextConfig);
