import { afterEach, beforeAll, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  resolveRustScannerBinary,
  rustScannerDelegationEnabled,
  scanRepositoryViaRust,
} from "../src/infrastructure/rustScanner.ts";

const repoRoot = path.resolve(import.meta.dir, "..");
const rustBinary = path.join(repoRoot, "target/debug/groundatlas-scanner");
const fixtureRoot = path.join(repoRoot, "test/fixtures/basic");

beforeAll(() => {
  if (!existsSync(rustBinary)) {
    execFileSync("cargo", ["build", "-p", "groundatlas-scanner"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
});

afterEach(() => {
  delete process.env.GROUNDATLAS_RUST_SCANNER;
  delete process.env.GROUNDATLAS_RUST_SCANNER_BIN;
});

test("rustScannerDelegationEnabled defaults to Rust authority with explicit opt-out", () => {
  delete process.env.GROUNDATLAS_RUST_SCANNER;
  expect(rustScannerDelegationEnabled()).toBe(true);

  process.env.GROUNDATLAS_RUST_SCANNER = "0";
  expect(rustScannerDelegationEnabled()).toBe(false);

  process.env.GROUNDATLAS_RUST_SCANNER = "ts";
  expect(rustScannerDelegationEnabled()).toBe(false);

  process.env.GROUNDATLAS_RUST_SCANNER = "1";
  expect(rustScannerDelegationEnabled()).toBe(true);

  process.env.GROUNDATLAS_RUST_SCANNER = "true";
  expect(rustScannerDelegationEnabled()).toBe(true);
});

test("resolveRustScannerBinary honors GROUNDATLAS_RUST_SCANNER_BIN override", () => {
  process.env.GROUNDATLAS_RUST_SCANNER_BIN = rustBinary;
  expect(resolveRustScannerBinary()).toBe(rustBinary);
});

test("scanRepositoryViaRust returns full AtlasMap from groundatlas-scanner", () => {
  process.env.GROUNDATLAS_RUST_SCANNER_BIN = rustBinary;
  const atlas = scanRepositoryViaRust({
    cwd: fixtureRoot,
    outputDir: ".groundatlas",
    generatedAt: "2026-01-01T00:00:00.000Z",
  });

  expect(atlas.schemaVersion).toBe(2);
  expect(atlas.generator.name).toBe("GroundAtlas");
  expect(atlas.repository.name).toBe("fixture-basic");
  expect(atlas.sources.some((source) => source.path === "PROJECT.md")).toBe(true);
});

test("CLI scan delegates to Rust when GROUNDATLAS_RUST_SCANNER=1", () => {
  const result = spawnSync(
    "bun",
    ["run", path.join(repoRoot, "src/cli.ts"), "scan", "--json"],
    {
      cwd: fixtureRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        GROUNDATLAS_RUST_SCANNER: "1",
        GROUNDATLAS_RUST_SCANNER_BIN: rustBinary,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  expect(result.status).toBe(0);
  const payload = JSON.parse(result.stdout.trim()) as {
    schemaVersion: number;
    generator: { name: string };
    sources: Array<{ path: string }>;
  };
  expect(payload.schemaVersion).toBe(2);
  expect(payload.generator.name).toBe("GroundAtlas");
  expect(payload.sources.some((source) => source.path === "PROJECT.md")).toBe(true);
});