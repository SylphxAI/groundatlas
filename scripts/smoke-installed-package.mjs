import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function smokeInstalledPackage({
  packageSpec,
  sourceLabel,
  expectedVersion,
  registryUrl,
} = {}) {
  if (!packageSpec) throw new Error("packageSpec is required for installed package smoke.");

  const temp = mkdtempSync(path.join(tmpdir(), "groundatlas-install-smoke-"));
  try {
    const appDir = path.join(temp, "app");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(path.join(appDir, "package.json"), '{"type":"module"}\n');
    const installArgs = ["install", packageSpec, "--ignore-scripts"];
    if (registryUrl) installArgs.push("--registry", registryUrl);
    execFileSync("npm", installArgs, { cwd: appDir, stdio: "inherit" });

    const installedPackageJson = JSON.parse(
      readFileSync(path.join(appDir, "node_modules/groundatlas/package.json"), "utf8"),
    );
    if (expectedVersion && installedPackageJson.version !== expectedVersion) {
      throw new Error(
        `Installed groundatlas version ${installedPackageJson.version} does not match expected ${expectedVersion}.`,
      );
    }

    execFileSync(
      "node",
      [
        "-e",
        [
          "import('groundatlas').then((m)=>{",
          "const required=['scanRepository','auditAtlas','inspectFleet','inspectMachineProjectManifest','inspectMachineProjectManifests','validateMachineProjectManifestFile','validateProjectManifestFile','ATLAS_SCHEMA_VERSION'];",
          "for (const key of required) if (!m[key]) throw new Error('missing export '+key);",
          "console.log('library exports ok')",
          "})",
        ].join(" "),
      ],
      { cwd: appDir, stdio: "inherit" },
    );
    execFileSync(
      "node",
      [
        "-e",
        [
          "import('groundatlas/manifest').then((m)=>{",
          "const required=['inspectMachineProjectManifest','inspectMachineProjectManifests','validateProjectManifestFile'];",
          "for (const key of required) if (!m[key]) throw new Error('missing manifest export '+key);",
          "console.log('manifest exports ok')",
          "})",
        ].join(" "),
      ],
      { cwd: appDir, stdio: "inherit" },
    );
    execFileSync(
      "node",
      [
        "-e",
        [
          "const { readFileSync } = require('node:fs');",
          "const schemaPath = require.resolve('groundatlas/schemas/project.manifest.schema.json');",
          "const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));",
          "if (schema.title !== 'Project Manifest' || schema.properties?.schemaVersion?.const !== 1) throw new Error('invalid schema export');",
          "console.log('schema export ok')",
        ].join(" "),
      ],
      { cwd: appDir, stdio: "inherit" },
    );

    const repoDir = path.join(temp, "repo");
    mkdirSync(path.join(repoDir, "src"), { recursive: true });
    mkdirSync(path.join(repoDir, "test"), { recursive: true });
    mkdirSync(path.join(repoDir, "docs", "adr"), { recursive: true });
    mkdirSync(path.join(repoDir, "docs", "specs"), { recursive: true });
    mkdirSync(path.join(repoDir, ".github", "workflows"), { recursive: true });
    mkdirSync(path.join(repoDir, ".doctrine"), { recursive: true });
    writeFileSync(
      path.join(repoDir, "package.json"),
      JSON.stringify(
        {
          name: "installed-smoke",
          type: "module",
          scripts: { test: "node src/index.js" },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(repoDir, "PROJECT.md"),
      "# Installed Smoke\n\nFixture for installed GroundAtlas package smoke.\n",
    );
    writeFileSync(
      path.join(repoDir, "README.md"),
      "# Installed Smoke\n\nPublic entry point for installed GroundAtlas package smoke.\n",
    );
    writeFileSync(path.join(repoDir, "AGENTS.md"), "# Agent Instructions\n\nFixture only.\n");
    writeFileSync(
      path.join(repoDir, "SECURITY.md"),
      "# Security\n\nReport fixture vulnerabilities through the test owner.\n",
    );
    writeFileSync(
      path.join(repoDir, "docs/adr/ADR-1-installed-smoke.md"),
      "# ADR-1: Installed smoke fixture\n\nThis fixture proves package install behavior.\n",
    );
    writeFileSync(
      path.join(repoDir, "docs/specs/product.md"),
      "# Product Spec\n\nThis fixture provides complete GroundAtlas fleet smoke surfaces.\n",
    );
    writeFileSync(path.join(repoDir, "test/index.test.js"), "import '../src/index.js';\n");
    writeFileSync(
      path.join(repoDir, ".github/workflows/ci.yml"),
      "name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n",
    );
    writeFileSync(
      path.join(repoDir, "project.manifest.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          project: {
            id: "installed-smoke",
            name: "Installed Smoke",
            summary: "Installed package fixture for GroundAtlas.",
            lifecycle: "active",
          },
          commands: [
            {
              name: "manifest-check",
              command: "node scripts/check-manifest.js",
              purpose: "Prove installed packages read neutral manifest validation commands.",
            },
          ],
          adoption: { status: "adopted" },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(repoDir, ".doctrine/project.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          project: {
            repo: "SylphxAI/installed-smoke",
            name: "Installed Smoke",
            lifecycle: "active",
            layer: "tooling",
            summary: "Installed package fixture for GroundAtlas.",
            goals: ["test installed package"],
            nonGoals: ["production"],
          },
          boundaries: {
            owns: [{ name: "fixture", description: "Fixture context." }],
            doesNotOwn: ["real production"],
            publicSurfaces: [],
            allowedDependencies: [],
            forbiddenCouplings: ["none"],
          },
          documentation: {
            adr: { path: "docs/adr/", status: "planned" },
            specs: { path: "docs/", status: "planned" },
            catalog: { path: ".doctrine/project.json", status: "present" },
            runbooks: { path: "PROJECT.md", status: "present" },
            generatedReferences: { path: ".groundatlas/", status: "generated" },
          },
          delivery: {
            ciModel: "legacy-ci",
            requiredContexts: ["test"],
            deployPath: "none",
            productionProof: "none",
            recoveryClass: "source-revertable",
          },
          adoption: { status: "baseline", gaps: [] },
        },
        null,
        2,
      ),
    );
    writeFileSync(path.join(repoDir, "src/index.js"), "export const ok = true;\n");
    execFileSync("git", ["init", "-b", "main"], { cwd: repoDir, stdio: "ignore" });
    execFileSync("git", ["add", "."], { cwd: repoDir, stdio: "ignore" });
    execFileSync(
      "git",
      ["-c", "user.email=test@example.com", "-c", "user.name=Test", "commit", "-m", "init"],
      { cwd: repoDir, stdio: "ignore" },
    );

    const ga = path.join(appDir, "node_modules/.bin/ga");
    const groundatlas = path.join(appDir, "node_modules/.bin/groundatlas");
    execFileSync(groundatlas, ["--help"], { cwd: repoDir, stdio: "ignore" });
    if (expectedVersion) {
      for (const binary of [groundatlas, ga]) {
        const actualVersion = execFileSync(binary, ["--version"], {
          cwd: repoDir,
          encoding: "utf8",
        }).trim();
        if (actualVersion !== expectedVersion) {
          throw new Error(
            `${path.basename(binary)} version ${actualVersion} != ${expectedVersion}`,
          );
        }
      }
    }
    execFileSync(ga, ["init"], { cwd: repoDir, stdio: "inherit" });
    const manifest = JSON.parse(
      execFileSync(ga, ["manifest", "project.manifest.json", "--json"], {
        cwd: repoDir,
        encoding: "utf8",
      }),
    );
    if (manifest.report?.valid !== true || manifest.report?.adapter !== false) {
      throw new Error(`installed package manifest smoke failed: ${JSON.stringify(manifest)}`);
    }
    execFileSync(ga, ["update"], { cwd: repoDir, stdio: "inherit" });
    execFileSync(ga, ["audit"], { cwd: repoDir, stdio: "inherit" });
    const fleet = JSON.parse(
      execFileSync(ga, ["fleet", ".", "--require-atlas", "--json"], {
        cwd: repoDir,
        encoding: "utf8",
      }),
    );
    const project = fleet.projects?.[0];
    if (fleet.summary?.blocked !== 0 || !project) {
      throw new Error(`installed package fleet smoke blocked: ${JSON.stringify(fleet.summary)}`);
    }
    if (project.status !== "adopted") {
      throw new Error(
        `installed package fleet smoke must be adopted, got ${project.status}: ${JSON.stringify(
          project.issues,
        )}`,
      );
    }
    if (project.manifest?.path !== "project.manifest.json" || project.manifest?.valid !== true) {
      throw new Error("installed package smoke did not select a valid vendor-neutral manifest");
    }
    if (
      !project.manifestAdapters?.some(
        (manifest) => manifest.path === ".doctrine/project.json" && manifest.valid === true,
      )
    ) {
      throw new Error("installed package smoke did not report a valid Doctrine adapter separately");
    }
    if (project.generatedAtlas?.ok !== true) {
      throw new Error("installed package smoke did not pass generated atlas audit");
    }
    if (
      !project.validationCommands?.some(
        (command) =>
          command.command === "node scripts/check-manifest.js" &&
          command.source === "project.manifest.json",
      )
    ) {
      throw new Error("installed package smoke did not read neutral manifest validation commands");
    }
    execFileSync(ga, ["explain", "project manifest"], { cwd: repoDir, stdio: "ignore" });

    const evidence = {
      sourceLabel,
      packageSpec,
      installedVersion: installedPackageJson.version,
      fleetStatus: project.status,
      selectedManifest: project.manifest.path,
      manifestValidation: manifest.report.path,
      adapterPaths: project.manifestAdapters.map((manifest) => manifest.path),
      manifestCommandSource: "project.manifest.json",
      schemaExport: "groundatlas/schemas/project.manifest.schema.json",
    };
    console.log(JSON.stringify(evidence, null, 2));
    return evidence;
  } finally {
    rmSync(temp, { force: true, recursive: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  smokeInstalledPackage({
    packageSpec: process.argv[2],
    sourceLabel: process.env.GROUNDATLAS_PACKAGE_SOURCE ?? "installed-package",
    expectedVersion: process.env.GROUNDATLAS_EXPECTED_VERSION,
    registryUrl: process.env.GROUNDATLAS_NPM_REGISTRY,
  });
}
