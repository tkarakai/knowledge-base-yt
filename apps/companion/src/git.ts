import { resolve, relative, isAbsolute } from "node:path";
import { ApiError } from "./state";
async function git(root: string, args: string[], env?: Record<string, string>) {
  const child = Bun.spawn(["git", "-C", root, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: env ? { ...process.env, ...env } : undefined,
  });
  const [out, , code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0)
    throw new ApiError(
      500,
      "Git operation failed; accepted files remain saved",
    );
  return out.trim();
}
/** Commit exact accepted paths with --only, excluding unrelated staged entries. */
export async function commitAccepted(
  root: string,
  files: string[],
  sourceId: string,
): Promise<string | null> {
  if (!files.length) return null;
  let repo: string;
  try {
    repo = await git(root, ["rev-parse", "--show-toplevel"]);
  } catch {
    return null;
  }
  const paths = files.map((file) => {
    const absolute = resolve(root, file),
      rel = relative(repo, absolute);
    if (
      rel.startsWith("..") ||
      isAbsolute(rel) ||
      !file.startsWith("knowledge/")
    )
      throw new ApiError(400, "Invalid commit path");
    return rel;
  });
  // --only commits listed working-tree paths while preserving unrelated staged entries.
  await git(repo, ["add", "--", ...paths]);
  const changed = await git(repo, [
    "diff",
    "--cached",
    "--name-only",
    "--",
    ...paths,
  ]);
  if (!changed) return null;
  await git(repo, [
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "--only",
    "--no-gpg-sign",
    "-m",
    `kb: integrate ${sourceId}`,
    "--",
    ...paths,
  ]);
  return git(repo, ["rev-parse", "HEAD"]);
}
