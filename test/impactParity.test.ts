import { afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeImpact } from "../src/application/impact.ts";
import { scanRepository } from "../src/application/scan.ts";
import { scanRepositoryViaRust } from "../src/infrastructure/rustScanner.ts";

const repoRoot = path.resolve(import.meta.dir, "..");
const rustBinary = path.join(repoRoot, "target/debug/groundatlas-scanner");
const generatedAt = "2026-01-01T00:00:00.000Z";
const generatorVersion = "0.1.3";

let tempRoot: string;
let fixtureRoot: string;

beforeAll(() => {
  if (!existsSync(rustBinary)) {
    execFileSync("cargo", ["build", "-p", "groundatlas-scanner"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
  process.env.GROUNDATLAS_RUST_SCANNER_BIN = rustBinary;
  delete process.env.GROUNDATLAS_RUST_SCANNER;
});

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "groundatlas-impact-parity-"));
  fixtureRoot = path.join(tempRoot, "fixture");
  execFileSync("cp", ["-R", path.resolve("test/fixtures/basic"), fixtureRoot]);
  execFileSync("git", ["init", "-b", "main"], { cwd: fixtureRoot });
  execFileSync("git", ["add", "."], { cwd: fixtureRoot });
  execFileSync(
    "git",
    ["-c", "user.email=test@example.com", "-c", "user.name=Test", "commit", "-m", "init"],
    { cwd: fixtureRoot },
  );
  await writeFile(
    path.join(fixtureRoot, "PROJECT.md"),
    "# Fixture Basic\n\nChanged for impact analysis.\n",
  );
  execFileSync("git", ["add", "PROJECT.md"], { cwd: fixtureRoot });
  execFileSync(
    "git",
    ["-c", "user.email=test@example.com", "-c", "user.name=Test", "commit", "-m", "impact-change"],
    { cwd: fixtureRoot },
  );
});

afterEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

test("impact matched sources match between TS and Rust scan on basic fixture", async () => {
  const tsAtlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: ".groundatlas",
    now: new Date(generatedAt),
  });
  const rustAtlas = scanRepositoryViaRust({
    cwd: fixtureRoot,
    outputDir: ".groundatlas",
    generatedAt,
    generatorVersion,
  });

  const tsImpact = await analyzeImpact(fixtureRoot, "HEAD~1", tsAtlas);
  const rustImpact = await analyzeImpact(fixtureRoot, "HEAD~1", rustAtlas);

  expect(rustImpact.map((entry) => entry.path)).toEqual(tsImpact.map((entry) => entry.path));
  expect(rustImpact.map((entry) => entry.matchedSources.map((source) => source.path))).toEqual(
    tsImpact.map((entry) => entry.matchedSources.map((source) => source.path)),
  );
});

function runCliImpact(overrides: Record<string, string | undefined> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, GROUNDATLAS_RUST_SCANNER_BIN: rustBinary, ...overrides };
  return spawnSync(
    "bun",
    ["run", path.join(repoRoot, "src/cli.ts"), "impact", "--since", "HEAD~1", "--json"],
    {
      cwd: fixtureRoot,
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

test("CLI impact uses Rust authority by default", () => {
  delete process.env.GROUNDATLAS_RUST_SCANNER;
  const result = runCliImpact();
  expect(result.status).toBe(0);

  const payload = JSON.parse(result.stdout.trim()) as Array<{
    path: string;
    matchedSources: Array<{ path: string }>;
  }>;
  expect(payload.some((entry) => entry.path === "PROJECT.md")).toBe(true);
  expect(
    payload.some((entry) =>
      entry.matchedSources.some((source) => source.path === "PROJECT.md"),
    ),
  ).toBe(true);
});

test("CLI impact can opt out to TS when GROUNDATLAS_RUST_SCANNER=ts", () => {
  const result = runCliImpact({ GROUNDATLAS_RUST_SCANNER: "ts" });
  expect(result.status).toBe(0);

  const payload = JSON.parse(result.stdout.trim()) as Array<{
    path: string;
    matchedSources: Array<{ path: string }>;
  }>;
  expect(payload.some((entry) => entry.path === "PROJECT.md")).toBe(true);
  expect(
    payload.some((entry) =>
      entry.matchedSources.some((source) => source.path === "PROJECT.md"),
    ),
  ).toBe(true);
});