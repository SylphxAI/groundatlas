import { afterEach, beforeEach, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { auditAtlas } from "../src/application/audit.ts";
import { ensureConfig } from "../src/application/config.ts";
import { explainQuery } from "../src/application/explain.ts";
import { inspectFleet } from "../src/application/fleet.ts";
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

test("recognizes vendor-neutral machine project manifests without requiring doctrine", async () => {
  await rm(path.join(fixtureRoot, ".doctrine"), { force: true, recursive: true });
  await Bun.write(
    path.join(fixtureRoot, "project.manifest.json"),
    `${JSON.stringify({ name: "fixture-basic", lifecycle: "test" }, null, 2)}\n`,
  );
  const atlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: ".groundatlas",
    now: new Date("2026-01-01T00:00:00Z"),
  });
  expect(
    atlas.sources.some(
      (source) => source.path === "project.manifest.json" && source.kind === "project-manifest",
    ),
  ).toBe(true);
  expect(atlas.risks.some((risk) => risk.code === "missing-machine-project-manifest")).toBe(false);
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

test("fleet inspection reports dogfooding status without mutating source truth", async () => {
  const config = await ensureConfig(fixtureRoot);
  const atlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: config.outputDir,
    now: new Date("2026-01-01T00:00:00Z"),
  });
  await writeAtlas(path.join(fixtureRoot, config.outputDir), atlas);

  const report = await inspectFleet({
    cwd: tempRoot,
    paths: [fixtureRoot],
    requireAtlas: true,
    strict: true,
    now: new Date("2026-01-01T00:00:00Z"),
  });

  expect(report.summary.total).toBe(1);
  expect(report.summary.blocked).toBe(0);
  expect(report.summary.warning).toBe(1);
  expect(report.projects[0]?.generatedAtlas.ok).toBe(true);
  expect(report.projects[0]?.hasProjectFile).toBe(true);
  expect(report.projects[0]?.hasMachineManifest).toBe(true);
  expect(report.projects[0]?.manifest.path).toBe(".doctrine/project.json");
  expect(report.projects[0]?.manifest.adapter).toBe(true);
  expect(report.projects[0]?.manifest.valid).toBe(true);
  expect(report.projects[0]?.hasAgentAdapter).toBe(true);
  expect(report.projects[0]?.hasValidationCommands).toBe(true);
});

test("fleet inspection validates vendor-neutral project manifests", async () => {
  await rm(path.join(fixtureRoot, ".doctrine"), { force: true, recursive: true });
  await Bun.write(
    path.join(fixtureRoot, "project.manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        project: {
          id: "fixture-basic",
          name: "Fixture Basic",
          summary: "Fixture repository for GroundAtlas scanner tests.",
          lifecycle: "active",
          visibility: "open-source",
          repository: "https://github.com/SylphxAI/fixture-basic",
        },
        truth: {
          humanProjectFile: "PROJECT.md",
          agentAdapter: "AGENTS.md",
          source: ["src/"],
          tests: ["test/"],
        },
        surfaces: [{ type: "cli", name: "Fixture CLI", path: "package.json" }],
        commands: [{ name: "check", command: "bun test", purpose: "Run fixture tests." }],
        adoption: { status: "adopted" },
      },
      null,
      2,
    )}\n`,
  );

  const report = await inspectFleet({
    cwd: tempRoot,
    paths: [fixtureRoot],
    now: new Date("2026-01-01T00:00:00Z"),
  });

  expect(report.projects[0]?.manifest.path).toBe("project.manifest.json");
  expect(report.projects[0]?.manifest.kind).toBe("project.manifest");
  expect(report.projects[0]?.manifest.adapter).toBe(false);
  expect(report.projects[0]?.manifest.valid).toBe(true);
  expect(report.projects[0]?.manifest.projectId).toBe("fixture-basic");
  expect(report.projects[0]?.manifest.adoptionStatus).toBe("adopted");
  expect(
    report.projects[0]?.issues.some((issue) => issue.code === "invalid-project-manifest"),
  ).toBe(false);
});

test("fleet inspection prefers neutral manifests and reports ecosystem adapters separately", async () => {
  await Bun.write(
    path.join(fixtureRoot, "project.manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        project: {
          id: "fixture-basic",
          name: "Fixture Basic",
          summary: "Fixture repository for GroundAtlas scanner tests.",
          lifecycle: "active",
        },
        adoption: { status: "adopted" },
      },
      null,
      2,
    )}\n`,
  );

  const report = await inspectFleet({
    cwd: tempRoot,
    paths: [fixtureRoot],
    now: new Date("2026-01-01T00:00:00Z"),
  });

  expect(report.projects[0]?.manifest.path).toBe("project.manifest.json");
  expect(report.projects[0]?.manifest.adapter).toBe(false);
  expect(report.projects[0]?.manifestAdapters.map((manifest) => manifest.path)).toContain(
    ".doctrine/project.json",
  );
  expect(report.projects[0]?.detectedManifests.map((manifest) => manifest.path)).toEqual([
    "project.manifest.json",
    ".doctrine/project.json",
  ]);
});

test("fleet inspection accepts neutral manifest aliases in priority order", async () => {
  await rm(path.join(fixtureRoot, ".doctrine"), { force: true, recursive: true });
  await mkdir(path.join(fixtureRoot, ".project"), { recursive: true });
  await Bun.write(
    path.join(fixtureRoot, "groundatlas.project.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        project: {
          id: "fixture-groundatlas",
          name: "Fixture GroundAtlas",
          summary: "GroundAtlas alias fixture.",
          lifecycle: "active",
        },
      },
      null,
      2,
    )}\n`,
  );
  await Bun.write(
    path.join(fixtureRoot, ".project", "manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        project: {
          id: "fixture-project-folder",
          name: "Fixture Project Folder",
          summary: "Project folder alias fixture.",
          lifecycle: "active",
        },
      },
      null,
      2,
    )}\n`,
  );

  const report = await inspectFleet({
    cwd: tempRoot,
    paths: [fixtureRoot],
    now: new Date("2026-01-01T00:00:00Z"),
  });

  expect(report.projects[0]?.manifest.path).toBe("groundatlas.project.json");
  expect(report.projects[0]?.manifest.kind).toBe("groundatlas.project");
  expect(report.projects[0]?.detectedManifests.map((manifest) => manifest.path)).toEqual([
    "groundatlas.project.json",
    ".project/manifest.json",
  ]);
});

test("fleet inspection blocks invalid vendor-neutral project manifests", async () => {
  await rm(path.join(fixtureRoot, ".doctrine"), { force: true, recursive: true });
  await Bun.write(
    path.join(fixtureRoot, "project.manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        project: {
          id: "Invalid ID",
          name: "",
          summary: "Invalid fixture manifest.",
          lifecycle: "unknown-lifecycle",
        },
      },
      null,
      2,
    )}\n`,
  );

  const report = await inspectFleet({
    cwd: tempRoot,
    paths: [fixtureRoot],
    now: new Date("2026-01-01T00:00:00Z"),
  });

  expect(report.summary.blocked).toBe(1);
  expect(report.projects[0]?.manifest.valid).toBe(false);
  expect(report.projects[0]?.status).toBe("blocked");
  expect(
    report.projects[0]?.issues.some((issue) => issue.code === "invalid-project-manifest"),
  ).toBe(true);
});

test("fleet inspection blocks malformed vendor-neutral project manifest JSON", async () => {
  await rm(path.join(fixtureRoot, ".doctrine"), { force: true, recursive: true });
  await Bun.write(path.join(fixtureRoot, "project.manifest.json"), "{not-json");

  const report = await inspectFleet({
    cwd: tempRoot,
    paths: [fixtureRoot],
    now: new Date("2026-01-01T00:00:00Z"),
  });

  expect(report.summary.blocked).toBe(1);
  expect(report.projects[0]?.manifest.path).toBe("project.manifest.json");
  expect(report.projects[0]?.manifest.valid).toBe(false);
  expect(
    report.projects[0]?.issues.some((issue) => issue.code === "invalid-project-manifest-json"),
  ).toBe(true);
});

test("fleet inspection blocks neutral manifest adoption status blocked", async () => {
  await rm(path.join(fixtureRoot, ".doctrine"), { force: true, recursive: true });
  await Bun.write(
    path.join(fixtureRoot, "project.manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        project: {
          id: "fixture-basic",
          name: "Fixture Basic",
          summary: "Fixture repository for GroundAtlas scanner tests.",
          lifecycle: "active",
        },
        adoption: { status: "blocked" },
      },
      null,
      2,
    )}\n`,
  );

  const report = await inspectFleet({
    cwd: tempRoot,
    paths: [fixtureRoot],
    now: new Date("2026-01-01T00:00:00Z"),
  });

  expect(report.summary.blocked).toBe(1);
  expect(report.projects[0]?.manifest.valid).toBe(false);
  expect(report.projects[0]?.manifest.adoptionStatus).toBe("blocked");
  expect(
    report.projects[0]?.issues.some((issue) => issue.code === "project-manifest-adoption-blocked"),
  ).toBe(true);
});

test("fleet inspection validates neutral manifest exception records", async () => {
  await rm(path.join(fixtureRoot, ".doctrine"), { force: true, recursive: true });
  await Bun.write(
    path.join(fixtureRoot, "project.manifest.json"),
    `${JSON.stringify(
      {
        $schema: "./schemas/project.manifest.schema.json",
        schemaVersion: 1,
        project: {
          id: "fixture-basic",
          name: "Fixture Basic",
          summary: "Fixture repository for GroundAtlas scanner tests.",
          lifecycle: "active",
        },
        adoption: {
          status: "exception",
          exceptions: [{ id: "missing-owner", owner: "", reason: "temporary exception" }],
        },
      },
      null,
      2,
    )}\n`,
  );

  const report = await inspectFleet({
    cwd: tempRoot,
    paths: [fixtureRoot],
    now: new Date("2026-01-01T00:00:00Z"),
  });

  expect(report.summary.blocked).toBe(1);
  expect(report.projects[0]?.manifest.valid).toBe(false);
  expect(
    report.projects[0]?.issues.some(
      (issue) =>
        issue.code === "invalid-project-manifest" &&
        issue.message.includes("adoption.exceptions[0].expiresAt"),
    ),
  ).toBe(true);
});

test("fleet inspection rejects impossible exception expiry dates", async () => {
  await rm(path.join(fixtureRoot, ".doctrine"), { force: true, recursive: true });
  await Bun.write(
    path.join(fixtureRoot, "project.manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        project: {
          id: "fixture-basic",
          name: "Fixture Basic",
          summary: "Fixture repository for GroundAtlas scanner tests.",
          lifecycle: "active",
        },
        adoption: {
          status: "exception",
          exceptions: [
            {
              id: "calendar-date",
              owner: "Fixture Owner",
              reason: "Test invalid calendar dates.",
              expiresAt: "2026-02-31",
            },
          ],
        },
      },
      null,
      2,
    )}\n`,
  );

  const report = await inspectFleet({
    cwd: tempRoot,
    paths: [fixtureRoot],
    now: new Date("2026-01-01T00:00:00Z"),
  });

  expect(report.summary.blocked).toBe(1);
  expect(
    report.projects[0]?.issues.some(
      (issue) =>
        issue.code === "invalid-project-manifest" &&
        issue.message.includes("must be a valid YYYY-MM-DD date"),
    ),
  ).toBe(true);
});

test("fleet inspection blocks commercial dogfooding when machine manifest is missing", async () => {
  await rm(path.join(fixtureRoot, ".doctrine"), { force: true, recursive: true });

  const report = await inspectFleet({
    cwd: tempRoot,
    paths: [fixtureRoot],
    now: new Date("2026-01-01T00:00:00Z"),
  });

  expect(report.summary.total).toBe(1);
  expect(report.summary.blocked).toBe(1);
  expect(report.projects[0]?.status).toBe("blocked");
  expect(
    report.projects[0]?.issues.some((issue) => issue.code === "missing-machine-project-manifest"),
  ).toBe(true);
});
