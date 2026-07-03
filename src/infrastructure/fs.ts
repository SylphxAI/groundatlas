import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EXCLUDES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".DS_Store",
  ".cache",
  ".next",
  ".turbo",
  ".vercel",
  "coverage",
  "dist",
  "dist-types",
  "build",
  "node_modules",
  "vendor",
]);

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function isSecretPath(relativePath: string): boolean {
  const normalized = relativePath.toLowerCase();
  const base = path.posix.basename(normalized);
  if (base === ".env" || base.startsWith(".env.")) {
    return !base.endsWith(".example") && !base.endsWith(".sample") && !base.endsWith(".template");
  }
  return (
    normalized.includes("/secrets/") ||
    normalized.includes("/private/") ||
    base.includes("id_rsa") ||
    base.includes("id_ed25519") ||
    base.endsWith(".pem") ||
    base.endsWith(".key") ||
    base.endsWith(".p12") ||
    base.endsWith(".pfx")
  );
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    return null;
  }
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

export type FileEntry = {
  path: string;
  absolutePath: string;
  sizeBytes: number;
};

export async function walkFiles(root: string, outputDir: string): Promise<FileEntry[]> {
  const files: FileEntry[] = [];

  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = toPosixPath(path.join(relativeDirectory, entry.name));
      if (entry.isDirectory()) {
        if (DEFAULT_EXCLUDES.has(entry.name) || relativePath === outputDir) {
          continue;
        }
        await visit(path.join(directory, entry.name), relativePath);
        continue;
      }
      if (!entry.isFile() || isSecretPath(relativePath)) {
        continue;
      }
      const absolutePath = path.join(root, relativePath);
      const fileStat = await stat(absolutePath);
      files.push({ absolutePath, path: relativePath, sizeBytes: fileStat.size });
    }
  }

  await visit(root, "");
  return files;
}
