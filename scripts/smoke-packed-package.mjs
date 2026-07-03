import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const temp = mkdtempSync(path.join(tmpdir(), "groundatlas-pack-smoke-"));
try {
  const packName = execFileSync("npm", ["pack", "--pack-destination", temp], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  })
    .trim()
    .split("\n")
    .at(-1);

  if (!packName) {
    throw new Error("npm pack did not return a tarball name");
  }

  const appDir = path.join(temp, "app");
  mkdirSync(appDir, { recursive: true });
  writeFileSync(path.join(appDir, "package.json"), '{"type":"module"}\n');
  execFileSync("npm", ["install", path.join(temp, packName)], { cwd: appDir, stdio: "inherit" });
  execFileSync(
    "node",
    [
      "-e",
      "import('groundatlas').then((m)=>{ if (!m.scanRepository || !m.auditAtlas || !m.inspectFleet || !m.inspectMachineProjectManifest || !m.inspectMachineProjectManifests || !m.ATLAS_SCHEMA_VERSION) throw new Error('missing exports'); console.log('library exports ok') })",
    ],
    { cwd: appDir, stdio: "inherit" },
  );

  const repoDir = path.join(temp, "repo");
  mkdirSync(path.join(repoDir, "src"), { recursive: true });
  mkdirSync(path.join(repoDir, ".doctrine"), { recursive: true });
  writeFileSync(
    path.join(repoDir, "package.json"),
    JSON.stringify(
      { name: "packed-smoke", type: "module", scripts: { test: "node src/index.js" } },
      null,
      2,
    ),
  );
  writeFileSync(
    path.join(repoDir, "PROJECT.md"),
    "# Packed Smoke\n\nFixture for packed GroundAtlas smoke.\n",
  );
  writeFileSync(path.join(repoDir, "AGENTS.md"), "# Agent Instructions\n\nFixture only.\n");
  writeFileSync(
    path.join(repoDir, "project.manifest.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        project: {
          id: "packed-smoke",
          name: "Packed Smoke",
          summary: "Packed smoke fixture for GroundAtlas.",
          lifecycle: "active",
        },
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
          repo: "SylphxAI/packed-smoke",
          name: "Packed Smoke",
          lifecycle: "active",
          layer: "tooling",
          summary: "Packed smoke fixture for GroundAtlas.",
          goals: ["test package"],
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
  execFileSync(ga, ["init"], { cwd: repoDir, stdio: "inherit" });
  execFileSync(ga, ["update"], { cwd: repoDir, stdio: "inherit" });
  execFileSync(ga, ["audit"], { cwd: repoDir, stdio: "inherit" });
  const fleet = JSON.parse(
    execFileSync(ga, ["fleet", ".", "--require-atlas", "--json"], {
      cwd: repoDir,
      encoding: "utf8",
    }),
  );
  if (fleet.projects?.[0]?.manifest?.path !== "project.manifest.json") {
    throw new Error("packed smoke did not select the vendor-neutral project manifest");
  }
  if (
    !fleet.projects?.[0]?.manifestAdapters?.some(
      (manifest) => manifest.path === ".doctrine/project.json",
    )
  ) {
    throw new Error("packed smoke did not report the Doctrine adapter separately");
  }
  execFileSync(ga, ["explain", "project manifest"], { cwd: repoDir, stdio: "ignore" });
  console.log("Packed package smoke passed.");
} finally {
  rmSync(temp, { force: true, recursive: true });
}
