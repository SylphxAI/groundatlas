import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export type RustScanStub = {
  schema_version: number;
  stub: boolean;
  repository: {
    name: string;
    root: string;
  };
  generator: {
    name: string;
    version: string;
  };
  risks: Array<{
    severity: string;
    code: string;
    message: string;
  }>;
};

export function rustScannerDelegationEnabled(): boolean {
  const flag = process.env.GROUNDATLAS_RUST_SCANNER?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function resolveRustScannerBinary(): string | null {
  const override = process.env.GROUNDATLAS_RUST_SCANNER_BIN?.trim();
  if (override) {
    return existsSync(override) ? override : null;
  }

  const candidates = [
    path.join(PACKAGE_ROOT, "target/release/groundatlas-scanner"),
    path.join(PACKAGE_ROOT, "target/debug/groundatlas-scanner"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function scanRepositoryViaRust(options: {
  cwd: string;
  outputDir: string;
}): RustScanStub {
  const binary = resolveRustScannerBinary();
  if (!binary) {
    throw new Error(
      "GROUNDATLAS_RUST_SCANNER is enabled but groundatlas-scanner binary was not found. Build with `cargo build -p groundatlas-scanner` or set GROUNDATLAS_RUST_SCANNER_BIN.",
    );
  }

  const result = spawnSync(
    binary,
    ["scan", "--cwd", options.cwd, "--output-dir", options.outputDir],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? "";
    throw new Error(
      `groundatlas-scanner scan failed (exit ${result.status ?? "unknown"}): ${stderr || "no stderr"}`,
    );
  }

  const stdout = result.stdout?.trim();
  if (!stdout) {
    throw new Error("groundatlas-scanner scan returned empty stdout.");
  }

  const parsed = JSON.parse(stdout) as RustScanStub;
  if (!parsed.stub || parsed.schema_version !== 2) {
    throw new Error("groundatlas-scanner scan returned unexpected S0 stub shape.");
  }
  return parsed;
}