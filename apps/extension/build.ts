import { cp, mkdir, rm } from "node:fs/promises";
const outdir = `${import.meta.dir}/dist`;
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
for (const [entries, format] of [
  [["background", "panel"], "esm"],
  [["content"], "iife"],
] as const) {
  const result = await Bun.build({
    entrypoints: entries.map((name) => `${import.meta.dir}/src/${name}.ts`),
    outdir,
    target: "browser",
    format,
  });
  if (!result.success)
    throw new AggregateError(result.logs, "Extension build failed");
}
await cp(`${import.meta.dir}/static`, outdir, { recursive: true });
console.log(`Load unpacked extension: ${outdir}`);
