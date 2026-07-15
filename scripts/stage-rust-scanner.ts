#!/usr/bin/env bun
/**
 * Stage groundatlas-scanner into bin/native for npm pack (fail-closed).
 * Without this, published packages default GROUNDATLAS_RUST_SCANNER=1 but ship no binary.
 */
import { copyFileSync, chmodSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const outDir = path.join(root, "bin/native");
const outBin = path.join(outDir, "groundatlas-scanner");

const candidates = [
  path.join(root, "target/release/groundatlas-scanner"),
  path.join(root, "target/debug/groundatlas-scanner"),
];

let src = candidates.find((c) => existsSync(c));
if (!src) {
  console.log("[stage-rust-scanner] building release groundatlas-scanner...");
  const build = spawnSync("cargo", ["build", "--release", "-p", "groundatlas-scanner"], {
    cwd: root,
    stdio: "inherit",
  });
  if (build.status !== 0) {
    console.error("[stage-rust-scanner] cargo build failed");
    process.exit(1);
  }
  src = path.join(root, "target/release/groundatlas-scanner");
}

if (!existsSync(src)) {
  console.error("[stage-rust-scanner] missing binary after build:", src);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
copyFileSync(src, outBin);
chmodSync(outBin, 0o755);
console.log(`[stage-rust-scanner] staged ${outBin}`);
