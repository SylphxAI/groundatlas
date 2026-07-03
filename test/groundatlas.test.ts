import { afterEach, beforeEach, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { auditAtlas } from "../src/application/audit.ts";
import { ensureConfig } from "../src/application/config.ts";
import { explainQuery } from "../src/application/explain.ts";
import { writeAtlas } from "../src/application/generate.ts";
import { scanRepository } from "../src/application/scan.ts";
import { ATLAS_SCHEMA_VERSION, GENERATED_BANNER } from "../src/domain/types.ts";

let tempRoot: string;
let fixtureRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "groundatlas-test-"));
  fixtureRoot = path.join(tempRoot, "fixture");
  execFileSync("cp", ["-R", path.resolve("test/fixtures/basic"), fixtureRoot]);
  await Bun.write(path.join(fixtureRoot, ".env"), "SHOULD_NOT_BE_SCANNED=secret\n");
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

test("scanRepository identifies canonical sources and skips secrets", async () => {
  const atlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: ".groundatlas",
    now: new Date("2026-01-01T00:00:00Z"),
  });
  expect(atlas.repository.name).toBe("fixture-basic");
  expect(
    atlas.sources.some(
      (source) => source.path === "PROJECT.md" && source.kind === "project-manifest",
    ),
  ).toBe(true);
  expect(
    atlas.sources.some(
      (source) => source.path === "docs/adr/ADR-1-fixture.md" && source.kind === "adr",
    ),
  ).toBe(true);
  expect(
    atlas.orientation.some((step) => step.title === "Project identity and machine manifest"),
  ).toBe(true);
  expect(atlas.truth.model).toBe("fact-scoped-ssot");
  expect(atlas.sources.some((source) => source.path === ".env")).toBe(false);
  expect(atlas.risks.some((risk) => risk.severity === "error")).toBe(false);
});

test("writeAtlas creates generated files with non-SSOT banner and audit passes", async () => {
  const config = await ensureConfig(fixtureRoot);
  const atlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: config.outputDir,
    now: new Date("2026-01-01T00:00:00Z"),
  });
  await writeAtlas(path.join(fixtureRoot, config.outputDir), atlas);
  const readme = await readFile(path.join(fixtureRoot, config.outputDir, "README.md"), "utf8");
  expect(readme).toContain(GENERATED_BANNER);
  const audit = await auditAtlas(fixtureRoot, config.outputDir);
  expect(audit.ok).toBe(true);
});

test("audit fails when generated banner is missing", async () => {
  await mkdir(path.join(fixtureRoot, ".groundatlas"), { recursive: true });
  await Bun.write(
    path.join(fixtureRoot, ".groundatlas", "atlas.json"),
    JSON.stringify({
      schemaVersion: ATLAS_SCHEMA_VERSION,
      policy: { generatedDocsAreNotSsot: true },
      risks: [],
    }),
  );
  await Bun.write(path.join(fixtureRoot, ".groundatlas", "README.md"), "# Missing banner");
  await Bun.write(path.join(fixtureRoot, ".groundatlas", "source-map.md"), "# Missing banner");
  await Bun.write(path.join(fixtureRoot, ".groundatlas", "change-guide.md"), "# Missing banner");
  const audit = await auditAtlas(fixtureRoot, ".groundatlas");
  expect(audit.ok).toBe(false);
  expect(audit.issues.some((issue) => issue.code === "missing-generated-banner")).toBe(true);
});

test("audit fails when generated atlas is stale", async () => {
  const config = await ensureConfig(fixtureRoot);
  const atlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: config.outputDir,
    now: new Date("2026-01-01T00:00:00Z"),
  });
  await writeAtlas(path.join(fixtureRoot, config.outputDir), atlas);
  await Bun.write(
    path.join(fixtureRoot, "PROJECT.md"),
    "# Fixture Basic\n\nChanged after atlas generation.\n",
  );
  const audit = await auditAtlas(fixtureRoot, config.outputDir);
  expect(audit.ok).toBe(false);
  expect(audit.issues.some((issue) => issue.code === "stale-atlas")).toBe(true);
});

test("explainQuery returns source-grounded matches", async () => {
  const atlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: ".groundatlas",
    now: new Date("2026-01-01T00:00:00Z"),
  });
  await writeAtlas(path.join(fixtureRoot, ".groundatlas"), atlas);
  const matches = await explainQuery(fixtureRoot, ".groundatlas", "project manifest");
  expect(matches.map((match) => match.path)).toContain("PROJECT.md");
});

test("classifies specs and design docs as product contracts, not tests", async () => {
  await mkdir(path.join(fixtureRoot, "docs/specs"), { recursive: true });
  await Bun.write(path.join(fixtureRoot, "docs/specs/product-spec.md"), "# Product Spec\n");
  await Bun.write(path.join(fixtureRoot, "DESIGN.md"), "# Design\n");
  const atlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: ".groundatlas",
    now: new Date("2026-01-01T00:00:00Z"),
  });
  expect(atlas.sources.find((source) => source.path === "docs/specs/product-spec.md")?.kind).toBe(
    "spec",
  );
  expect(atlas.sources.find((source) => source.path === "DESIGN.md")?.kind).toBe("design-doc");
  expect(atlas.orientation.find((step) => step.title === "Specs and design intent")?.present).toBe(
    true,
  );
});
