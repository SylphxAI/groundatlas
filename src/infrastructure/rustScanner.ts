import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import packageJson from "../../package.json" with { type: "json" };
import type { AtlasMap } from "../domain/types.js";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { version: packageVersion } = packageJson;

/**
 * Whether the published npm CLI `scan` command delegates to groundatlas-scanner.
 *
 * Default: Rust authority (unset env). Explicit opt-out: GROUNDATLAS_RUST_SCANNER=0|ts|false|no.
 */
export function rustScannerDelegationEnabled(): boolean {
  const flag = process.env.GROUNDATLAS_RUST_SCANNER?.trim().toLowerCase();
  if (!flag) {
    return true;
  }
  if (flag === "0" || flag === "false" || flag === "no" || flag === "ts") {
    return false;
  }
  return flag === "1" || flag === "true" || flag === "yes";
}

export function resolveRustScannerBinary(): string | null {
  const override = process.env.GROUNDATLAS_RUST_SCANNER_BIN?.trim();
  if (override) {
    return existsSync(override) ? override : null;
  }

  const candidates = [
    // Published npm pack path (must ship with the package)
    path.join(PACKAGE_ROOT, "bin/native/groundatlas-scanner"),
    path.join(PACKAGE_ROOT, "target/release/groundatlas-scanner"),
    path.join(PACKAGE_ROOT, "target/debug/groundatlas-scanner"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function scanRepositoryViaRust(options: {
  cwd: string;
  outputDir: string;
  generatedAt?: string;
  generatorVersion?: string;
}): AtlasMap {
  const binary = resolveRustScannerBinary();
  if (!binary) {
    throw new Error(
      "GROUNDATLAS_RUST_SCANNER is enabled but groundatlas-scanner binary was not found. Build with `cargo build -p groundatlas-scanner` or set GROUNDATLAS_RUST_SCANNER_BIN.",
    );
  }

  const args = ["scan", "--cwd", options.cwd, "--output-dir", options.outputDir];
  if (options.generatedAt) {
    args.push("--generated-at", options.generatedAt);
  }
  args.push("--generator-version", options.generatorVersion ?? packageVersion);

  const result = spawnSync(binary, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

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

  const parsed = JSON.parse(stdout) as AtlasMap;
  if (parsed.schemaVersion !== 2 || parsed.generator.name !== "GroundAtlas") {
    throw new Error("groundatlas-scanner scan returned unexpected AtlasMap shape.");
  }
  return parsed;
}
