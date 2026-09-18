import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { getGitBranch } from "@repo/design-system/build-utils";

const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const gitBranch = getGitBranch();

// CSP is handled by proxy.ts (nonce-based)
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-XSS-Protection", value: "0" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    ...(gitBranch ? { NEXT_PUBLIC_GIT_BRANCH: gitBranch } : {}),
  },
  transpilePackages: ["@repo/design-system", "@repo/auth", "@repo/backend", "@repo/edge-rate-limit"],
  headers: async () => [{ source: "/(.*)", headers: securityHeaders }],
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
