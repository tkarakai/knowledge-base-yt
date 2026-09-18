import { createCompanion } from "./index";
const app = await createCompanion({
  vaultPath: process.env.KB_VAULT_PATH ?? "./vault",
  token: process.env.KB_COMPANION_TOKEN ?? "",
  port: Number(process.env.KB_COMPANION_PORT ?? 4317),
  allowedOrigins: process.env.KB_ALLOWED_ORIGINS?.split(",")
    .map((x) => x.trim())
    .filter(Boolean),
});
const server = app.start();
console.log(`Knowledge companion listening on http://127.0.0.1:${server.port}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    server.stop();
    app.close();
    process.exit(0);
  });
