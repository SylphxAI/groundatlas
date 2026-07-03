#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const claimBoundary = "pre-npm-pilot-only";

const repoInputs = parseRepoInputs(process.argv.slice(2), process.env.GROUNDATLAS_DOGFOOD_REPOS);
if (repoInputs.length === 0) {
  console.error(
    "No dogfood repositories provided. Pass paths as arguments or set GROUNDATLAS_DOGFOOD_REPOS.",
  );
  process.exit(1);
}

const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "groundatlas-external-dogfood-"));
const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  claimBoundary,
  groundatlasPackageSource: "packed-local-tarball",
  packageName: packageJson.name,
  packageVersion: packageJson.version,
  packagePublished: await isPackagePublished(packageJson.name),
  repositories: [],
};

try {
  run("bun", ["run", "build"], { cwd: repoRoot });
  const tarball = packGroundAtlas(tmpRoot);
  const installRoot = path.join(tmpRoot, "install");
  await makeInstallProject(installRoot, tarball);

  const groundatlasBin = path.join(installRoot, "node_modules", ".bin", "groundatlas");
  const gaBin = path.join(installRoot, "node_modules", ".bin", "ga");
  run(groundatlasBin, ["--help"]);

  for (const repoInput of repoInputs) {
    evidence.repositories.push(
      await dogfoodRepository({ repoInput, tmpRoot, groundatlasBin, gaBin, installRoot }),
    );
  }

  console.log(JSON.stringify(evidence, null, 2));

  const failed = evidence.repositories.some(
    (repo) => repo.mutatedOriginalRepo || !repo.auditOk || !repo.scanOk || !repo.fleetCommandOk,
  );
  process.exitCode = failed ? 1 : 0;
} finally {
  if (process.env.GROUNDATLAS_KEEP_DOGFOOD_TMP !== "1") {
    await rm(tmpRoot, { force: true, recursive: true });
  }
}

function parseRepoInputs(argv, envValue) {
  const values = argv.length > 0 ? argv : splitEnvList(envValue ?? "");
  return values.map((value) => path.resolve(value)).filter((value) => value.length > 0);
}

function splitEnvList(value) {
  return value
    .split(/[,:]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function packGroundAtlas(destination) {
  const output = run("npm", ["pack", "--pack-destination", destination, "--json"], {
    cwd: repoRoot,
  });
  const packResult = JSON.parse(output)[0];
  if (!packResult?.filename) throw new Error("npm pack did not return a filename.");
  return path.join(destination, packResult.filename);
}

async function makeInstallProject(installRoot, tarball) {
  await rm(installRoot, { force: true, recursive: true });
  await mkdir(installRoot, { recursive: true });
  await writeFile(path.join(installRoot, "package.json"), '{"private":true,"type":"module"}\n');
  run("npm", ["install", "--silent", tarball], { cwd: installRoot });
}

async function dogfoodRepository({ repoInput, tmpRoot, groundatlasBin, gaBin, installRoot }) {
  if (!existsSync(repoInput)) {
    return {
      targetRepo: repoInput,
      claimBoundary,
      error: "target repo path does not exist",
      scanOk: false,
      auditOk: false,
      fleetCommandOk: false,
      mutatedOriginalRepo: false,
      packagePublished: evidence.packagePublished,
    };
  }

  const originalStatusBefore = gitStatus(repoInput);
  const targetRef = gitMaybe(repoInput, ["rev-parse", "HEAD"]);
  const targetBranch = gitMaybe(repoInput, ["branch", "--show-current"]);
  const targetCopy = path.join(tmpRoot, `target-${evidence.repositories.length}`);
  await cp(repoInput, targetCopy, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (source) => {
      const base = path.basename(source);
      return (
        base !== ".git" &&
        base !== "node_modules" &&
        !source.includes(`${path.sep}node_modules${path.sep}`)
      );
    },
  });

  const outputDir = ".groundatlas-pilot";
  const scan = JSON.parse(
    run(gaBin, ["scan", "--cwd", targetCopy, "--json"], { cwd: installRoot }),
  );
  run(gaBin, ["init", "--cwd", targetCopy, "--out", outputDir], { cwd: installRoot });
  const audit = JSON.parse(
    run(gaBin, ["audit", "--cwd", targetCopy, "--out", outputDir, "--json"], {
      cwd: installRoot,
    }),
  );
  const explain = run(
    groundatlasBin,
    ["explain", "project manifest", "--cwd", targetCopy, "--out", outputDir, "--json"],
    { cwd: installRoot },
  );
  const fleetResult = runAllowFailure(
    gaBin,
    [
      "fleet",
      targetCopy,
      "--cwd",
      path.dirname(targetCopy),
      "--out",
      outputDir,
      "--require-atlas",
      "--json",
    ],
    { cwd: installRoot },
  );
  const fleet = JSON.parse(fleetResult.stdout);

  const originalStatusAfter = gitStatus(repoInput);
  const mutatedOriginalRepo = originalStatusBefore !== originalStatusAfter;
  const sourcePaths = new Set(scan.sources.map((source) => source.path));

  return {
    targetRepo: repoInput,
    targetCopy,
    targetRef,
    targetBranch,
    claimBoundary,
    groundatlasPackageSource: "packed-local-tarball",
    packagePublished: evidence.packagePublished,
    installedVersion: run(groundatlasBin, ["--version"], { cwd: installRoot }).trim(),
    outputDir,
    scanOk: scan.schemaVersion === 2,
    auditOk: audit.ok === true,
    fleetCommandOk: fleetResult.status === 0 || fleetResult.status === 1,
    mutatedOriginalRepo,
    originalRepoStatusBefore: originalStatusBefore,
    originalRepoStatusAfter: originalStatusAfter,
    detectedProjectManifest:
      [...sourcePaths].find((sourcePath) =>
        [
          "project.manifest.json",
          "groundatlas.project.json",
          ".project/manifest.json",
          ".doctrine/project.json",
        ].includes(sourcePath),
      ) ?? null,
    detectedAgentAdapter:
      [...sourcePaths].find((sourcePath) =>
        ["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md", ".cursor/rules"].includes(
          sourcePath,
        ),
      ) ?? null,
    explainMatches: JSON.parse(explain).map((entry) => entry.path),
    fleetStatus: fleet.projects[0]?.status ?? "unknown",
    fleetIssues: fleet.projects[0]?.issues ?? [],
  };
}

async function isPackagePublished(packageName) {
  const result = spawnSync("npm", ["view", packageName, "version", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return result.status === 0;
}

function gitStatus(cwd) {
  return gitMaybe(cwd, ["status", "--short"]);
}

function gitMaybe(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit ${result.status}\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result.stdout;
}

function runAllowFailure(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status === null || result.stdout.length === 0) {
    throw new Error(
      `${command} ${args.join(" ")} did not produce parseable stdout\\n${result.stdout}\\n${result.stderr}`,
    );
  }
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}
