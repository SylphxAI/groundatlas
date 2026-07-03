import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitState } from "../domain/types.ts";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd, timeout: 10_000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function readGitState(cwd: string): Promise<GitState> {
  const [branch, head, status, remote] = await Promise.all([
    git(cwd, ["branch", "--show-current"]),
    git(cwd, ["rev-parse", "HEAD"]),
    git(cwd, ["status", "--porcelain"]),
    git(cwd, ["remote", "get-url", "origin"]),
  ]);
  return {
    branch: branch || null,
    head: head || null,
    isDirty: Boolean(status),
    remote: remote || null,
  };
}

export type GitDiffEntry = {
  status: string;
  path: string;
};

export async function readGitDiff(cwd: string, since: string): Promise<GitDiffEntry[]> {
  const output = await git(cwd, ["diff", "--name-status", since, "--"]);
  if (!output) {
    return [];
  }
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status = "?", ...parts] = line.split(/\s+/u);
      return { status, path: parts.at(-1) ?? "" };
    })
    .filter((entry) => entry.path.length > 0);
}
