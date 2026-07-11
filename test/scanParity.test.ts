import { afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { scanRepository } from "../src/application/scan.ts";
import type { AtlasMap } from "../src/domain/types.ts";
import { scanRepositoryViaRust } from "../src/infrastructure/rustScanner.ts";
import {
  cleanupScanFixture,
  CORPUS_RELATIVE,
  GENERATED_AT,
  GENERATOR_VERSION,
  GOLDEN_RELATIVE,
  loadGoldenAtlas,
  normalizeAtlas,
  prepareBasicScanFixture,
  sha256File,
} from "./differential/scanFixture.ts";

const repoRoot = path.resolve(import.meta.dir, "..");
const rustBinary = path.join(repoRoot, "target/debug/groundatlas-scanner");
const goldenPath = path.join(repoRoot, GOLDEN_RELATIVE);
const corpusPath = path.join(repoRoot, CORPUS_RELATIVE);

let tempRoot: string;
let fixtureRoot: string;

beforeAll(() => {
  if (!existsSync(rustBinary)) {
    execFileSync("cargo", ["build", "-p", "groundatlas-scanner"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
  if (!existsSync(rustBinary)) {
    throw new Error(
      "scanParity: groundatlas-scanner binary missing after build — fail-closed (no SKIP-as-pass)",
    );
  }
  if (!existsSync(corpusPath)) {
    throw new Error(`scanParity: missing behavior spec at ${corpusPath}`);
  }
});

beforeEach(async () => {
  ({ tempRoot, fixtureRoot } = await prepareBasicScanFixture(repoRoot));
});

afterEach(async () => {
  await cleanupScanFixture(tempRoot);
});

test("committed golden baseline hash is SHA-bound to behavior spec", () => {
  const goldenHash = sha256File(goldenPath);
  expect(goldenHash).toMatch(/^[a-f0-9]{64}$/);
  expect(existsSync(corpusPath)).toBe(true);
});

test("TS scan matches committed golden baseline on prepared basic fixture", async () => {
  const golden = loadGoldenAtlas(repoRoot);
  const atlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: ".groundatlas",
    now: new Date(GENERATED_AT),
  });

  expect(normalizeAtlas(atlas, fixtureRoot)).toEqual({
    ...golden,
    repository: {
      ...golden.repository,
      root: fixtureRoot,
    },
  });
});

test("Rust scan matches TS scan on prepared basic fixture", async () => {
  const tsAtlas = normalizeAtlas(
    await scanRepository({
      cwd: fixtureRoot,
      outputDir: ".groundatlas",
      now: new Date(GENERATED_AT),
    }),
    fixtureRoot,
  );

  process.env.GROUNDATLAS_RUST_SCANNER_BIN = rustBinary;
  const rustAtlas = normalizeAtlas(
    scanRepositoryViaRust({
      cwd: fixtureRoot,
      outputDir: ".groundatlas",
      generatedAt: GENERATED_AT,
      generatorVersion: GENERATOR_VERSION,
    }),
    fixtureRoot,
  );

  expect(rustAtlas).toEqual(tsAtlas);
});

function runCliScan(
  overrides: Record<string, string | undefined> = {},
  options?: { omitRustScannerFlag?: boolean },
) {
  const env: NodeJS.ProcessEnv = { ...process.env, GROUNDATLAS_RUST_SCANNER_BIN: rustBinary, ...overrides };
  if (options?.omitRustScannerFlag) {
    delete env.GROUNDATLAS_RUST_SCANNER;
  }
  return spawnSync("bun", ["run", path.join(repoRoot, "src/cli.ts"), "scan", "--json"], {
    cwd: fixtureRoot,
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

test("CLI scan defaults to Rust authority when GROUNDATLAS_RUST_SCANNER is unset", () => {
  const result = runCliScan({}, { omitRustScannerFlag: true });
  expect(result.status).toBe(0);
  const payload = JSON.parse(result.stdout.trim()) as AtlasMap;
  expect(payload.schemaVersion).toBe(2);
  expect(payload.generator.name).toBe("GroundAtlas");
  expect(payload.repository.name).toBe("fixture-basic");
  expect(payload.sources.some((source) => source.path === "PROJECT.md")).toBe(true);
});

test("CLI scan delegates full AtlasMap when GROUNDATLAS_RUST_SCANNER=1", () => {
  const result = runCliScan({ GROUNDATLAS_RUST_SCANNER: "1" });

  expect(result.status).toBe(0);
  const payload = JSON.parse(result.stdout.trim()) as AtlasMap;
  expect(payload.schemaVersion).toBe(2);
  expect(payload.generator.name).toBe("GroundAtlas");
  expect(payload.repository.name).toBe("fixture-basic");
  expect(payload.sources.some((source) => source.path === "PROJECT.md")).toBe(true);
});

test("CLI scan can opt out to TS when GROUNDATLAS_RUST_SCANNER=ts", () => {
  const result = runCliScan({ GROUNDATLAS_RUST_SCANNER: "ts" });

  expect(result.status).toBe(0);
  const payload = JSON.parse(result.stdout.trim()) as AtlasMap;
  expect(payload.schemaVersion).toBe(2);
  expect(payload.generator.name).toBe("GroundAtlas");
  expect(payload.repository.name).toBe("fixture-basic");
});