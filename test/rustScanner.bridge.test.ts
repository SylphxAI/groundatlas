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

test("rustScannerDelegationEnabled respects GROUNDATLAS_RUST_SCANNER", () => {
  delete process.env.GROUNDATLAS_RUST_SCANNER;
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

test("scanRepositoryViaRust returns S0 stub JSON from groundatlas-scanner", () => {
  process.env.GROUNDATLAS_RUST_SCANNER_BIN = rustBinary;
  const stub = scanRepositoryViaRust({
    cwd: repoRoot,
    outputDir: ".groundatlas",
  });

  expect(stub.stub).toBe(true);
  expect(stub.schema_version).toBe(2);
  expect(stub.generator.name).toBe("groundatlas-scanner");
  expect(stub.risks.some((risk) => risk.code === "rust-scan-stub")).toBe(true);
});

test("CLI scan delegates to Rust when GROUNDATLAS_RUST_SCANNER=1", () => {
  const result = spawnSync(
    "bun",
    ["run", path.join(repoRoot, "src/cli.ts"), "scan", "--json"],
    {
      cwd: repoRoot,
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
    stub: boolean;
    schema_version: number;
    risks: Array<{ code: string }>;
  };
  expect(payload.stub).toBe(true);
  expect(payload.schema_version).toBe(2);
  expect(payload.risks.some((risk) => risk.code === "rust-scan-stub")).toBe(true);
});