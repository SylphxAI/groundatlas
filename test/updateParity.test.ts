import { afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AtlasMap } from "../src/domain/types.ts";

const repoRoot = path.resolve(import.meta.dir, "..");
const rustBinary = path.join(repoRoot, "target/debug/groundatlas-scanner");

let tempRoot: string;
let fixtureRoot: string;

beforeAll(() => {
  if (!existsSync(rustBinary)) {
    execFileSync("cargo", ["build", "-p", "groundatlas-scanner"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
});

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "groundatlas-update-parity-"));
  fixtureRoot = path.join(tempRoot, "fixture");
  execFileSync("cp", ["-R", path.resolve("test/fixtures/basic"), fixtureRoot]);
  execFileSync("git", ["init", "-b", "main"], { cwd: fixtureRoot });
  execFileSync("git", ["add", "."], { cwd: fixtureRoot });
  execFileSync(
    "git",
    ["-c", "user.email=test@example.com", "-c", "user.name=Test", "commit", "-m", "init"],
    { cwd: fixtureRoot },
  );
  const init = spawnSync("bun", ["run", path.join(repoRoot, "src/cli.ts"), "init"], {
    cwd: fixtureRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      GROUNDATLAS_RUST_SCANNER_BIN: rustBinary,
      GROUNDATLAS_RUST_SCANNER: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  expect(init.status).toBe(0);
});

afterEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

function runCliUpdate(
  overrides: Record<string, string | undefined> = {},
  options?: { omitRustScannerFlag?: boolean },
) {
  const env: NodeJS.ProcessEnv = { ...process.env, GROUNDATLAS_RUST_SCANNER_BIN: rustBinary, ...overrides };
  if (options?.omitRustScannerFlag) {
    delete env.GROUNDATLAS_RUST_SCANNER;
  }
  return spawnSync("bun", ["run", path.join(repoRoot, "src/cli.ts"), "update"], {
    cwd: fixtureRoot,
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function readGeneratedAtlas(): AtlasMap {
  const atlasPath = path.join(fixtureRoot, ".groundatlas", "atlas.json");
  return JSON.parse(readFileSync(atlasPath, "utf8")) as AtlasMap;
}

test("CLI update defaults to Rust authority when GROUNDATLAS_RUST_SCANNER is unset", () => {
  const result = runCliUpdate({}, { omitRustScannerFlag: true });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("GroundAtlas updated .groundatlas/");
  const atlas = readGeneratedAtlas();
  expect(atlas.schemaVersion).toBe(2);
  expect(atlas.generator.name).toBe("GroundAtlas");
  expect(atlas.repository.name).toBe("fixture-basic");
  expect(atlas.sources.some((source) => source.path === "PROJECT.md")).toBe(true);
});

test("CLI update delegates full AtlasMap when GROUNDATLAS_RUST_SCANNER=1", () => {
  const result = runCliUpdate({ GROUNDATLAS_RUST_SCANNER: "1" });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("GroundAtlas updated .groundatlas/");
  const atlas = readGeneratedAtlas();
  expect(atlas.schemaVersion).toBe(2);
  expect(atlas.generator.name).toBe("GroundAtlas");
  expect(atlas.repository.name).toBe("fixture-basic");
  expect(atlas.sources.some((source) => source.path === "PROJECT.md")).toBe(true);
});

test("CLI update can opt out to TS when GROUNDATLAS_RUST_SCANNER=ts", () => {
  const result = runCliUpdate({ GROUNDATLAS_RUST_SCANNER: "ts" });

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("GroundAtlas updated .groundatlas/");
  const atlas = readGeneratedAtlas();
  expect(atlas.schemaVersion).toBe(2);
  expect(atlas.generator.name).toBe("GroundAtlas");
  expect(atlas.repository.name).toBe("fixture-basic");
});