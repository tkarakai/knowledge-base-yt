/** Start only the local KB slice; the starter's cloud/auth apps remain optional. */
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const token = process.env.KB_COMPANION_TOKEN || randomBytes(32).toString("hex");
if (token.length < 32)
  throw new Error("KB_COMPANION_TOKEN must contain at least 32 characters");
function preferredPort(name: string, fallback: number) {
  const port = Number(process.env[name] || fallback);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`${name} must be an integer between 1024 and 65535`);
  }
  return port;
}

async function availablePort(
  name: string,
  preferred: number,
  reserved?: number,
) {
  const last = process.env[name] ? preferred : Math.min(preferred + 100, 65535);
  for (let port = preferred; port <= last; port++) {
    if (port === reserved) continue;
    const free = await new Promise<boolean>((resolve, reject) => {
      const probe = createServer();
      probe.once("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") resolve(false);
        else reject(error);
      });
      probe.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
        probe.close(() => resolve(true));
      });
    });
    if (free) return port;
  }
  throw new Error(
    `${name}: port ${preferred} is unavailable. Choose a free port.`,
  );
}

const preferredWebPort = preferredPort("KB_WEB_PORT", 3001);
const preferredCompanionPort = preferredPort("KB_COMPANION_PORT", 4317);

// The starter and KB share apps/web/.next/dev, even on different HTTP ports.
// Only the starter's verified web process may be stopped automatically.
const restart = Bun.spawnSync(
  [
    "python3",
    resolve(root, "scripts/dev-processes.py"),
    "stop",
    "--name",
    "next-web",
  ],
  { cwd: root, stdout: "inherit", stderr: "inherit" },
);
if (restart.exitCode !== 0) {
  throw new Error(
    "Unable to verify the previous web server; no KB services started.",
  );
}
const lock = resolve(root, "apps/web/.next/dev/lock");
if (existsSync(lock)) {
  const owner = Bun.spawnSync(["lsof", "-t", lock]);
  if (owner.exitCode === 0 && owner.stdout.toString().trim()) {
    throw new Error(
      "This checkout already has a Next.js dev server. Stop it from its original terminal, then run bun run dev:kb again.",
    );
  }
}
const webPort = await availablePort("KB_WEB_PORT", preferredWebPort);
const companionPort = await availablePort(
  "KB_COMPANION_PORT",
  preferredCompanionPort,
  webPort,
);
const env = {
  ...process.env,
  KB_COMPANION_TOKEN: token,
  KB_COMPANION_PORT: String(companionPort),
  KB_COMPANION_URL: `http://127.0.0.1:${companionPort}`,
  KB_VAULT_PATH: resolve(root, process.env.KB_VAULT_PATH || "vault"),
  KB_WEB_ORIGIN: `http://127.0.0.1:${webPort}`,
  KB_ALLOWED_ORIGINS: `http://127.0.0.1:${webPort},http://localhost:${webPort}`,
  NEXT_PUBLIC_SITE_URL:
    process.env.NEXT_PUBLIC_SITE_URL || `http://127.0.0.1:${webPort}`,
};
const companion = Bun.spawn(
  [process.execPath, "--watch", "apps/companion/src/main.ts"],
  {
    cwd: root,
    env,
    stdout: "inherit",
    stderr: "inherit",
  },
);
const children: Bun.Subprocess[] = [companion];
let shutdown: Promise<void> | undefined;
function stop() {
  shutdown ??= (async () => {
    for (const child of children) {
      if (child.exitCode === null) child.kill("SIGTERM");
    }
    const timeout = setTimeout(() => {
      for (const child of children) {
        if (child.exitCode === null) child.kill("SIGKILL");
      }
    }, 3000);
    await Promise.all(children.map((child) => child.exited));
    clearTimeout(timeout);
  })();
  return shutdown;
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void stop().then(() => process.exit(0)));
}

try {
  let healthy = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (companion.exitCode !== null)
      throw new Error("Companion failed to start; see the error above");
    try {
      const response = await fetch(`${env.KB_COMPANION_URL}/health`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        healthy = true;
        break;
      }
    } catch {
      /* Companion is still starting. */
    }
    await Bun.sleep(100);
  }
  if (!healthy) {
    throw new Error("Companion health check timed out");
  }
  const web = Bun.spawn(
    [
      process.execPath,
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(webPort),
    ],
    { cwd: resolve(root, "apps/web"), env, stdout: "pipe", stderr: "inherit" },
  );
  children.push(web);
  const output = (async () => {
    const decoder = new TextDecoder();
    let recent = "";
    let announced = false;
    for await (const chunk of web.stdout) {
      process.stdout.write(chunk);
      recent = (recent + decoder.decode(chunk, { stream: true })).slice(-4096);
      if (!announced && recent.includes("Ready in")) {
        announced = true;
        console.log(
          `\nKnowledge Base → http://127.0.0.1:${webPort}/kb\nCompanion → ${env.KB_COMPANION_URL}\nVault → ${env.KB_VAULT_PATH}\nCompanion is authenticated; the session token is kept out of browser code.\n`,
        );
      }
    }
  })();
  const code = await Promise.race(children.map((child) => child.exited));
  process.exitCode = code || 0;
  await stop();
  await output;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await stop();
}
