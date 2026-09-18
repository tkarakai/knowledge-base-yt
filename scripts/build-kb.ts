import { resolve } from "node:path";

// The retained starter routes validate public URLs at module evaluation during
// Next's whole-app build. Local defaults satisfy that configuration without
// requiring a running Convex deployment. /kb never loads their auth providers.
const child = Bun.spawn(
  [process.execPath, "node_modules/next/dist/bin/next", "build"],
  {
    cwd: resolve(import.meta.dir, "../apps/web"),
    env: {
      ...process.env,
      NEXT_PUBLIC_SITE_URL:
        process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3001",
      NEXT_PUBLIC_LANDING_URL:
        process.env.NEXT_PUBLIC_LANDING_URL || "http://127.0.0.1:3000",
      NEXT_PUBLIC_CONVEX_URL:
        process.env.NEXT_PUBLIC_CONVEX_URL || "http://127.0.0.1:3210",
      NEXT_PUBLIC_CONVEX_SITE_URL:
        process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "http://127.0.0.1:3211",
    },
    stdout: "inherit",
    stderr: "inherit",
  },
);
process.exit(await child.exited);
