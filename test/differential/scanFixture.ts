import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { scanRepository } from "../../src/application/scan.ts";
import type { AtlasMap } from "../../src/domain/types.ts";

export const GENERATED_AT = "2026-01-01T00:00:00.000Z";
export const GENERATOR_VERSION = "0.1.3";
/** Pin fixture git commits so parity baselines stay reproducible across hosts. */
export const FIXTURE_GIT_COMMIT_DATE = "2026-01-01T00:00:00Z";
export const BASIC_FIXTURE_RELATIVE = "test/fixtures/basic";
export const GOLDEN_RELATIVE = "test/fixtures/basic/atlas.golden.json";
/** Expected scan output baseline — must not be copied into temp scan fixtures. */
export const EXCLUDED_SCAN_BASELINE = "atlas.golden.json";
export const CORPUS_RELATIVE = "scripts/differential/fixtures/basic-scan-corpus.json";

export function repoRootFrom(moduleDir: string): string {
  return path.resolve(moduleDir, "../..");
}

export function normalizeAtlas(atlas: AtlasMap, root: string): AtlasMap {
  return {
    ...atlas,
    generatedAt: GENERATED_AT,
    generator: { name: "GroundAtlas", version: GENERATOR_VERSION },
    repository: {
      ...atlas.repository,
      root,
    },
  };
}

export async function prepareBasicScanFixture(repoRoot: string): Promise<{
  tempRoot: string;
  fixtureRoot: string;
}> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "groundatlas-parity-"));
  const fixtureRoot = path.join(tempRoot, "fixture");
  execFileSync("cp", ["-R", path.join(repoRoot, BASIC_FIXTURE_RELATIVE), fixtureRoot]);
  const goldenInFixture = path.join(fixtureRoot, EXCLUDED_SCAN_BASELINE);
  if (existsSync(goldenInFixture)) {
    await rm(goldenInFixture);
  }
  await writeFile(path.join(fixtureRoot, ".env"), "SHOULD_NOT_BE_SCANNED=secret\n");
  execFileSync("git", ["init", "-b", "main"], { cwd: fixtureRoot });
  execFileSync("git", ["add", "."], { cwd: fixtureRoot });
  execFileSync(
    "git",
    ["-c", "user.email=test@example.com", "-c", "user.name=Test", "commit", "-m", "init"],
    {
      cwd: fixtureRoot,
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: FIXTURE_GIT_COMMIT_DATE,
        GIT_COMMITTER_DATE: FIXTURE_GIT_COMMIT_DATE,
      },
    },
  );
  return { tempRoot, fixtureRoot };
}

export async function cleanupScanFixture(tempRoot: string): Promise<void> {
  await rm(tempRoot, { force: true, recursive: true });
}

export async function scanTsOracleAtlas(_repoRoot: string, fixtureRoot: string): Promise<AtlasMap> {
  const atlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: ".groundatlas",
    now: new Date(GENERATED_AT),
  });
  return normalizeAtlas(atlas, fixtureRoot);
}

export function loadGoldenAtlas(repoRoot: string): AtlasMap {
  const goldenPath = path.join(repoRoot, GOLDEN_RELATIVE);
  if (!existsSync(goldenPath)) {
    throw new Error(`missing golden baseline at ${goldenPath}`);
  }
  return JSON.parse(readFileSync(goldenPath, "utf8")) as AtlasMap;
}

export function sha256File(filePath: string): string {
  const raw = readFileSync(filePath);
  return createHash("sha256").update(raw).digest("hex");
}

export function sha256Json(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
