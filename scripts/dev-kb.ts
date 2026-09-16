/** Start only the local KB slice; the starter's cloud/auth apps remain optional. */
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const token = process.env.KB_COMPANION_TOKEN || randomBytes(32).toString("hex");
if (token.length < 32)
  throw new Error("KB_COMPANION_TOKEN must contain at least 32 characters");
const webPort = Number(process.env.KB_WEB_PORT || 3001);
const companionPort = Number(process.env.KB_COMPANION_PORT || 4317);
for (const port of [webPort, companionPort])
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Ports must be integers between 1024 and 65535");
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
const companion = Bun.spawn([process.execPath, "apps/companion/src/main.ts"], {
  cwd: root,
  env,
  stdout: "inherit",
  stderr: "inherit",
});
const children = [companion];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
    process.exit(code);
  }, 1500).unref();
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

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
  stop(1);
  throw new Error("Companion health check timed out");
}
console.log(
  `\nKnowledge Base → http://127.0.0.1:${webPort}/kb\nVault → ${env.KB_VAULT_PATH}\nCompanion is authenticated; the session token is kept out of browser code.\n`,
);
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
  { cwd: resolve(root, "apps/web"), env, stdout: "inherit", stderr: "inherit" },
);
children.push(web);
const code = await Promise.race(children.map((child) => child.exited));
stop(code || 0);
await Promise.all(children.map((child) => child.exited));
