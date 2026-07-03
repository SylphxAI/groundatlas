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
import { validateProjectManifestFile } from "../src/application/projectManifest.ts";
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

test("scanRepository classifies root action.yml as a GitHub Action public surface", async () => {
  await Bun.write(
    path.join(fixtureRoot, "action.yml"),
    "name: Fixture Action\nruns:\n  using: composite\n  steps: []\n",
  );
  const atlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: ".groundatlas",
    now: new Date("2026-01-01T00:00:00Z"),
  });
  expect(
    atlas.sources.some((source) => source.path === "action.yml" && source.kind === "github-action"),
  ).toBe(true);
  expect(
    atlas.publicSurfaces.some(
      (surface) => surface.path === "action.yml" && surface.type === "github-action",
    ),
  ).toBe(true);
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

test("scanRepository reads validation commands from neutral manifests for non-package repos", async () => {
  await rm(path.join(fixtureRoot, "package.json"), { force: true });
  await rm(path.join(fixtureRoot, ".doctrine"), { force: true, recursive: true });
  await Bun.write(
    path.join(fixtureRoot, "project.manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        project: {
          id: "fixture-basic",
          name: "Fixture Basic",
          summary: "Fixture repository for manifest-declared validation commands.",
          lifecycle: "active",
        },
        commands: [
          {
            name: "check",
            command: "python3 tests/test_fixture.py",
            purpose: "Run the repository validation suite without requiring package.json.",
          },
        ],
        adoption: { status: "adopted" },
      },
      null,
      2,
    )}\n`,
  );

  const atlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: ".groundatlas",
    now: new Date("2026-01-01T00:00:00Z"),
  });

  expect(atlas.repository.packageManager).toBe("unknown");
  expect(atlas.validationCommands).toEqual([
    {
      command: "python3 tests/test_fixture.py",
      source: "project.manifest.json",
      reason:
        "project manifest declares the check validation command: Run the repository validation suite without requiring package.json.",
    },
  ]);
  expect(atlas.risks.some((risk) => risk.code === "missing-validation-commands")).toBe(false);
});

test("scanRepository keeps package validation commands first and dedupes manifest commands", async () => {
  await Bun.write(
    path.join(fixtureRoot, "project.manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        project: {
          id: "fixture-basic",
          name: "Fixture Basic",
          summary: "Fixture repository for package and manifest validation commands.",
          lifecycle: "active",
        },
        commands: [
          {
            name: "check",
            command: "bun run check",
            purpose: "Duplicate package check command.",
          },
          {
            name: "docs",
            command: "python3 scripts/check_docs.py",
            purpose: "Validate docs-only repository policy.",
          },
        ],
        adoption: { status: "adopted" },
      },
      null,
      2,
    )}\n`,
  );

  const atlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: ".groundatlas",
    now: new Date("2026-01-01T00:00:00Z"),
  });

  expect(atlas.validationCommands.filter((command) => command.command === "bun run check")).toEqual(
    [
      {
        command: "bun run check",
        source: "package.json",
        reason: "package.json defines the check validation script.",
      },
    ],
  );
  expect(atlas.validationCommands).toContainEqual({
    command: "python3 scripts/check_docs.py",
    source: "project.manifest.json",
    reason:
      "project manifest declares the docs validation command: Validate docs-only repository policy.",
  });
});

test("scanRepository uses only the selected valid neutral manifest for commands", async () => {
  await rm(path.join(fixtureRoot, "package.json"), { force: true });
  await rm(path.join(fixtureRoot, ".doctrine"), { force: true, recursive: true });
  await Bun.write(
    path.join(fixtureRoot, "project.manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        project: {
          id: "fixture-basic",
          name: "Fixture Basic",
          summary: "Higher-priority manifest with no command declarations.",
          lifecycle: "active",
        },
        adoption: { status: "adopted" },
      },
      null,
      2,
    )}\n`,
  );
  await Bun.write(
    path.join(fixtureRoot, "groundatlas.project.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        project: {
          id: "fixture-lower-priority",
          name: "Fixture Lower Priority",
          summary: "Lower-priority alias must not fill selected-manifest gaps.",
          lifecycle: "active",
        },
        commands: [
          {
            name: "check",
            command: "python3 tests/lower_priority.py",
            purpose: "This must not count while project.manifest.json is selected.",
          },
        ],
        adoption: { status: "adopted" },
      },
      null,
      2,
    )}\n`,
  );

  const atlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: ".groundatlas",
    now: new Date("2026-01-01T00:00:00Z"),
  });

  expect(atlas.validationCommands).toEqual([]);
  expect(atlas.risks.some((risk) => risk.code === "missing-validation-commands")).toBe(true);
});

test("scanRepository does not trust invalid neutral manifest commands or adapter commands", async () => {
  await rm(path.join(fixtureRoot, "package.json"), { force: true });
  await Bun.write(
    path.join(fixtureRoot, "project.manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        project: {
          id: "fixture-basic",
          name: "Fixture Basic",
          summary: "Invalid command shape must not satisfy validation-command adoption.",
          lifecycle: "active",
        },
        commands: [{ name: "check", command: "python3 tests/test_fixture.py" }],
        adoption: { status: "adopted" },
      },
      null,
      2,
    )}\n`,
  );
  await Bun.write(
    path.join(fixtureRoot, ".doctrine", "project.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        project: {
          repo: "SylphxAI/fixture-basic",
          name: "Fixture Basic",
          lifecycle: "active",
        },
        commands: [
          {
            name: "adapter-check",
            command: "python3 tests/adapter.py",
            purpose: "Doctrine adapter commands are not the public validation-command default.",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  const validation = await validateProjectManifestFile(
    path.join(fixtureRoot, "project.manifest.json"),
    "project.manifest.json",
  );
  const atlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: ".groundatlas",
    now: new Date("2026-01-01T00:00:00Z"),
  });

  expect(validation.valid).toBe(false);
  expect(atlas.validationCommands).toEqual([]);
  expect(atlas.risks.some((risk) => risk.code === "missing-validation-commands")).toBe(true);
});

test("validateProjectManifestFile validates neutral manifests and adapters standalone", async () => {
  await Bun.write(
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

  const neutral = await validateProjectManifestFile(
    path.join(fixtureRoot, "project.manifest.json"),
    "project.manifest.json",
  );
  expect(neutral.valid).toBe(true);
  expect(neutral.adapter).toBe(false);
  expect(neutral.projectId).toBe("fixture-basic");

  const adapter = await validateProjectManifestFile(
    path.join(fixtureRoot, ".doctrine", "project.json"),
    ".doctrine/project.json",
  );
  expect(adapter.valid).toBe(true);
  expect(adapter.adapter).toBe(true);

  await Bun.write(path.join(fixtureRoot, "broken.manifest.json"), "{not json");
  const broken = await validateProjectManifestFile(
    path.join(fixtureRoot, "broken.manifest.json"),
    "broken.manifest.json",
  );
  expect(broken.valid).toBe(false);
  expect(broken.issues.some((issue) => issue.code === "invalid-project-manifest-json")).toBe(true);

  await Bun.write(
    path.join(fixtureRoot, "unsupported.manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        project: {
          id: "fixture-basic",
          name: "Fixture Basic",
          summary: "Fixture manifest.",
          lifecycle: "unsupported",
        },
        adoption: { status: "blocked" },
      },
      null,
      2,
    )}\n`,
  );
  const unsupported = await validateProjectManifestFile(
    path.join(fixtureRoot, "unsupported.manifest.json"),
    "unsupported.manifest.json",
  );
  expect(unsupported.valid).toBe(false);
  expect(unsupported.issues.some((issue) => issue.message.includes("schemaVersion"))).toBe(true);
  expect(unsupported.issues.some((issue) => issue.message.includes("project.lifecycle"))).toBe(
    true,
  );
  expect(
    unsupported.issues.some((issue) => issue.code === "project-manifest-adoption-blocked"),
  ).toBe(true);
});

test("manifest CLI validates explicit files, discovers manifests, and fails invalid input", async () => {
  await Bun.write(
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

  const explicit = JSON.parse(sourceCli(["manifest", "project.manifest.json", "--json"]));
  expect(explicit.report.valid).toBe(true);
  expect(explicit.report.path).toBe("project.manifest.json");

  const absolute = JSON.parse(
    sourceCli(["manifest", path.join(fixtureRoot, "project.manifest.json"), "--json"]),
  );
  expect(absolute.report.valid).toBe(true);
  expect(absolute.report.kind).toBe("project.manifest");

  const discovered = JSON.parse(sourceCli(["manifest", "--json"]));
  expect(discovered.selected.path).toBe("project.manifest.json");
  expect(
    discovered.adapters.some(
      (manifest: { path?: string; adapter?: boolean }) =>
        manifest.path === ".doctrine/project.json" && manifest.adapter === true,
    ),
  ).toBe(true);

  await Bun.write(path.join(fixtureRoot, "broken.manifest.json"), "{not json");
  const invalid = runFailingSourceCli(["manifest", "broken.manifest.json", "--json"]);
  expect(invalid.status).toBe(1);
  expect(JSON.parse(invalid.stdout).report.valid).toBe(false);

  const missing = runFailingSourceCli(["manifest", "missing.manifest.json", "--json"]);
  expect(missing.status).toBe(1);
  expect(JSON.parse(missing.stdout).report.issues[0].code).toBe("project-manifest-unreadable");

  const tooMany = runFailingSourceCli(["manifest", "one.json", "two.json"]);
  expect(tooMany.status).toBe(1);
  expect(tooMany.stderr).toContain("manifest accepts at most one path");
});

test("dogfood report assertion validates pre-npm and post-publish boundaries", async () => {
  const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8")) as {
    name: string;
    version: string;
  };
  const baseRepository = {
    targetRepo: fixtureRoot,
    claimBoundary: "pre-npm-pilot-only",
    groundatlasPackageSource: "packed-local-tarball",
    packageSpec: "/tmp/groundatlas-0.1.0.tgz",
    packagePublished: false,
    installedVersion: packageJson.version,
    scanOk: true,
    auditOk: true,
    manifestValidationOk: true,
    fleetCommandOk: true,
    mutatedOriginalRepo: false,
    originalRepoStatusBefore: "",
    originalRepoStatusAfter: "",
    detectedProjectManifest: "project.manifest.json",
    manifestValidation: {
      path: "project.manifest.json",
      adapter: false,
      valid: true,
    },
    fleetManifest: {
      path: "project.manifest.json",
      adapter: false,
      valid: true,
    },
    fleetManifestAdapters: [{ path: ".doctrine/project.json", adapter: true }],
    fleetStatus: "adopted",
    fleetIssues: [],
  };
  const preNpmReport = path.join(tempRoot, "pre-npm-dogfood.json");
  await Bun.write(
    preNpmReport,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        claimBoundary: "pre-npm-pilot-only",
        groundatlasPackageSource: "packed-local-tarball",
        packageSpec: "/tmp/groundatlas-0.1.0.tgz",
        packagePublished: false,
        repositories: [baseRepository],
      },
      null,
      2,
    )}\n`,
  );
  execFileSync(
    "node",
    [
      path.resolve("scripts/assert-dogfood-report.mjs"),
      preNpmReport,
      "--expect-pre-npm",
      "--expect-adopted",
      "--expect-neutral-manifest",
      "--expect-doctrine-adapter",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  const postPublishReport = path.join(tempRoot, "post-publish-dogfood.json");
  const packageSpec = `${packageJson.name}@${packageJson.version}`;
  await Bun.write(
    postPublishReport,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        claimBoundary: "post-publish-package-pilot",
        groundatlasPackageSource: "npm-registry",
        packageSpec,
        packagePublished: true,
        repositories: [
          {
            ...baseRepository,
            claimBoundary: "post-publish-package-pilot",
            groundatlasPackageSource: "npm-registry",
            packageSpec,
            packagePublished: true,
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  execFileSync(
    "node",
    [
      path.resolve("scripts/assert-dogfood-report.mjs"),
      postPublishReport,
      "--expect-post-publish",
      "--expect-adopted",
      "--expect-neutral-manifest",
      "--expect-doctrine-adapter",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
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

test("writeAtlas keeps generated output stable when source freshness is unchanged", async () => {
  const config = await ensureConfig(fixtureRoot);
  const firstAtlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: config.outputDir,
    now: new Date("2026-01-01T00:00:00Z"),
  });
  await writeAtlas(path.join(fixtureRoot, config.outputDir), firstAtlas);
  const firstJson = await readFile(path.join(fixtureRoot, config.outputDir, "atlas.json"), "utf8");

  const secondAtlas = await scanRepository({
    cwd: fixtureRoot,
    outputDir: config.outputDir,
    now: new Date("2026-01-02T00:00:00Z"),
  });
  await writeAtlas(path.join(fixtureRoot, config.outputDir), secondAtlas);
  const secondJson = await readFile(path.join(fixtureRoot, config.outputDir, "atlas.json"), "utf8");

  expect(secondJson).toBe(firstJson);
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

function sourceCli(args: string[]): string {
  return execFileSync("bun", ["run", path.resolve("src/cli.ts"), ...args], {
    cwd: fixtureRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function runFailingSourceCli(args: string[]): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  try {
    const stdout = sourceCli(args);
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      status?: number | null;
      stdout?: Buffer | string;
      stderr?: Buffer | string;
    };
    return {
      status: failure.status ?? null,
      stdout: String(failure.stdout ?? ""),
      stderr: String(failure.stderr ?? ""),
    };
  }
}
