import { afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inspectMachineProjectManifests } from "../src/application/projectManifest.ts";
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
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "groundatlas-manifest-parity-"));
  fixtureRoot = path.join(tempRoot, "fixture");
  execFileSync("cp", ["-R", path.resolve("test/fixtures/basic"), fixtureRoot]);
  await writeFile(
    path.join(fixtureRoot, "project.manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        project: {
          id: "fixture-basic",
          name: "Fixture Basic",
          summary: "Fixture manifest.",
          lifecycle: "active",
        },
        adoption: { status: "adopted" },
      },
      null,
      2,
    )}\n`,
  );
  execFileSync("git", ["init", "-b", "main"], { cwd: fixtureRoot });
  execFileSync("git", ["add", "."], { cwd: fixtureRoot });
  execFileSync(
    "git",
    ["-c", "user.email=test@example.com", "-c", "user.name=Test", "commit", "-m", "init"],
    { cwd: fixtureRoot },
  );
});

afterEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

test("manifest discovery source paths match between TS and Rust scan on basic fixture", async () => {
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

  const tsInspection = await inspectMachineProjectManifests(
    fixtureRoot,
    new Set(tsAtlas.sources.map((source) => source.path)),
  );
  const rustInspection = await inspectMachineProjectManifests(
    fixtureRoot,
    new Set(rustAtlas.sources.map((source) => source.path)),
  );

  expect(rustInspection.selected.path).toBe(tsInspection.selected.path);
  expect(rustInspection.selected.valid).toBe(tsInspection.selected.valid);
  expect(rustInspection.discovered.map((manifest) => manifest.path)).toEqual(
    tsInspection.discovered.map((manifest) => manifest.path),
  );
});

function runCliManifest(overrides: Record<string, string | undefined> = {}) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GROUNDATLAS_RUST_SCANNER_BIN: rustBinary,
    ...overrides,
  };
  return spawnSync("bun", ["run", path.join(repoRoot, "src/cli.ts"), "manifest", "--json"], {
    cwd: fixtureRoot,
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

test("CLI manifest discovery uses Rust authority by default", () => {
  delete process.env.GROUNDATLAS_RUST_SCANNER;
  const result = runCliManifest();
  expect(result.status).toBe(0);

  const payload = JSON.parse(result.stdout.trim()) as {
    selected: { path?: string; valid?: boolean };
    adapters: Array<{ path?: string; adapter?: boolean }>;
  };
  expect(payload.selected.path).toBe("project.manifest.json");
  expect(payload.selected.valid).toBe(true);
  expect(
    payload.adapters.some(
      (manifest) => manifest.path === ".doctrine/project.json" && manifest.adapter === true,
    ),
  ).toBe(true);
});

test("CLI manifest discovery can opt out to TS when GROUNDATLAS_RUST_SCANNER=ts", () => {
  const result = runCliManifest({ GROUNDATLAS_RUST_SCANNER: "ts" });
  expect(result.status).toBe(0);

  const payload = JSON.parse(result.stdout.trim()) as {
    selected: { path?: string; valid?: boolean };
  };
  expect(payload.selected.path).toBe("project.manifest.json");
  expect(payload.selected.valid).toBe(true);
});
