import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import packageJson from "../package.json" with { type: "json" };

const root = process.cwd();
const distCli = path.join(root, "dist", "cli.js");
const tempRoot = await mkdtemp(path.join(tmpdir(), "groundatlas-action-smoke-"));
const packDir = path.join(tempRoot, "package");
const runnerTemp = path.join(tempRoot, "runner");
const fixtureCopy = path.join(tempRoot, "fixture-basic");
const trackedFixtureCopy = path.join(tempRoot, "fixture-tracked-output");
const strictFailureFixtureCopy = path.join(tempRoot, "fixture-strict-warning");

await mkdir(packDir, { recursive: true });
await mkdir(runnerTemp, { recursive: true });
await cp(path.join(root, "test", "fixtures", "basic"), fixtureCopy, {
  recursive: true,
  force: true,
});
await cp(path.join(root, "test", "fixtures", "basic"), trackedFixtureCopy, {
  recursive: true,
  force: true,
});
await cp(path.join(root, "test", "fixtures", "basic"), strictFailureFixtureCopy, {
  recursive: true,
  force: true,
});
await writeNeutralProjectManifest(fixtureCopy);
await writeNeutralProjectManifest(trackedFixtureCopy);
await writeAdoptedRepoEvidence(fixtureCopy);
await writeAdoptedRepoEvidence(trackedFixtureCopy);

const action = await readFile(path.join(root, "action.yml"), "utf8");
const runBlock = extractRunBlock(action);
if (!runBlock) {
  throw new Error("action.yml must include a composite run block.");
}

const helpCheck = spawnSync(process.execPath, [distCli, "--help"], {
  cwd: root,
  encoding: "utf8",
});
if (helpCheck.status !== 0) {
  throw new Error(
    `dist/cli.js is not runnable. Run bun run build first.\n${helpCheck.stderr || helpCheck.stdout}`,
  );
}

const pack = spawnSync("npm", ["pack", "--silent", "--pack-destination", packDir], {
  cwd: root,
  encoding: "utf8",
});
if (pack.status !== 0) {
  throw new Error(`npm pack failed:\n${pack.stderr || pack.stdout}`);
}

const tarballName = pack.stdout.trim().split("\n").filter(Boolean).at(-1);
if (!tarballName) {
  throw new Error("npm pack did not report a tarball name.");
}
const tarballPath = path.join(packDir, tarballName);

const smoke = runAction({
  packageSpec: tarballPath,
  workingDirectory: fixtureCopy,
  outputDir: ".groundatlas-action-smoke",
  failOnDiff: false,
  manifestReportPath: "groundatlas-reports/manifest.json",
  fleetReportPath: "groundatlas-reports/fleet.json",
  fleetMarkdownReportPath: "groundatlas-reports/fleet.md",
  githubOutputPath: path.join(runnerTemp, "github-output-happy.txt"),
  githubStepSummaryPath: path.join(runnerTemp, "step-summary-happy.md"),
});

assertActionPassed(smoke, "GitHub Action smoke failed.", fixtureCopy);

const output = `${smoke.stdout}\n${smoke.stderr}`;
for (const required of [
  "GroundAtlas updated .groundatlas-action-smoke/",
  "GroundAtlas audit passed.",
  '"schemaVersion": 1',
  '"generatedAtlasRequired": true',
]) {
  if (!output.includes(required)) {
    throw new Error(`GitHub Action smoke output missing ${required}.\n${output}`);
  }
}
if (output.includes("stale-atlas")) {
  throw new Error(`Relative report paths polluted the freshness gate.\n${output}`);
}

const smokeOutputs = parseGithubOutput(
  await readFile(path.join(runnerTemp, "github-output-happy.txt"), "utf8"),
);
assertOutputPath(smokeOutputs, "manifest-report-path", fixtureCopy);
assertOutputPath(smokeOutputs, "fleet-report-path", fixtureCopy);
assertOutputPath(smokeOutputs, "fleet-markdown-report-path", fixtureCopy);

const manifestReport = await readJsonReport(smokeOutputs["manifest-report-path"]);
const fleetReport = await readJsonReport(smokeOutputs["fleet-report-path"]);
const fleetMarkdownReport = await readFile(smokeOutputs["fleet-markdown-report-path"], "utf8");
const stepSummaryReport = await readFile(path.join(runnerTemp, "step-summary-happy.md"), "utf8");
if (
  manifestReport.selected?.valid !== true ||
  manifestReport.selected?.path !== "project.manifest.json" ||
  manifestReport.selected?.adapter !== false
) {
  throw new Error(`GitHub Action manifest report was not valid: ${JSON.stringify(manifestReport)}`);
}
if (
  !manifestReport.discovered?.some(
    (manifest) => manifest.path === ".doctrine/project.json" && manifest.adapter === true,
  )
) {
  throw new Error(
    `GitHub Action manifest report did not preserve Doctrine as an adapter: ${JSON.stringify(
      manifestReport,
    )}`,
  );
}
if (fleetReport.summary?.total !== 1 || !fleetReport.projects?.[0]?.generatedAtlas?.checked) {
  throw new Error(`GitHub Action fleet report was not usable: ${JSON.stringify(fleetReport)}`);
}
if (
  fleetReport.projects?.[0]?.manifest?.path !== "project.manifest.json" ||
  fleetReport.projects?.[0]?.manifest?.adapter !== false ||
  !fleetReport.projects?.[0]?.manifestAdapters?.some(
    (manifest) => manifest.path === ".doctrine/project.json" && manifest.adapter === true,
  )
) {
  throw new Error(
    `GitHub Action fleet report did not select the neutral manifest with Doctrine as adapter: ${JSON.stringify(
      fleetReport,
    )}`,
  );
}
if (
  !fleetMarkdownReport.includes("# GroundAtlas fleet adoption report") ||
  !fleetMarkdownReport.includes("Summary: 1 adopted, 0 warning, 0 blocked, 1 total.")
) {
  throw new Error(`GitHub Action fleet Markdown report was not usable:\n${fleetMarkdownReport}`);
}
if (!stepSummaryReport.includes("Summary: 1 adopted, 0 warning, 0 blocked, 1 total.")) {
  throw new Error(
    `GitHub Action step summary did not include the fleet scorecard:\n${stepSummaryReport}`,
  );
}

if (!tarballName.includes(`${packageJson.version}.tgz`)) {
  throw new Error(
    `Packed tarball ${tarballName} does not match package version ${packageJson.version}.`,
  );
}

const trackedSeed = runAction({
  packageSpec: tarballPath,
  workingDirectory: trackedFixtureCopy,
  outputDir: ".groundatlas",
  failOnDiff: false,
});
assertActionPassed(
  trackedSeed,
  "GitHub Action tracked-output seed smoke failed.",
  trackedFixtureCopy,
);
for (const args of [
  ["init", "-b", "main"],
  ["add", "."],
  ["-c", "user.email=test@example.com", "-c", "user.name=Test", "commit", "-m", "seed"],
]) {
  const git = spawnSync("git", args, { cwd: trackedFixtureCopy, encoding: "utf8" });
  if (git.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed:\n${git.stderr || git.stdout}`);
  }
}

const trackedDiffGate = runAction({
  packageSpec: tarballPath,
  workingDirectory: trackedFixtureCopy,
  outputDir: ".groundatlas",
  failOnDiff: true,
});
assertActionPassed(
  trackedDiffGate,
  "GitHub Action fail-on-diff tracked-output smoke failed.",
  trackedFixtureCopy,
);

const strictFailure = runAction({
  packageSpec: tarballPath,
  workingDirectory: strictFailureFixtureCopy,
  outputDir: ".groundatlas",
  failOnDiff: false,
  strict: true,
  githubOutputPath: path.join(runnerTemp, "github-output-strict-failure.txt"),
  githubStepSummaryPath: path.join(runnerTemp, "step-summary-strict-failure.md"),
});
if (strictFailure.status === 0) {
  throw new Error("GitHub Action strict warning smoke unexpectedly passed.");
}
const strictFailureOutputs = parseGithubOutput(
  await readFile(path.join(runnerTemp, "github-output-strict-failure.txt"), "utf8"),
);
assertOutputPath(strictFailureOutputs, "manifest-report-path");
assertOutputPath(strictFailureOutputs, "fleet-report-path");
assertOutputPath(strictFailureOutputs, "fleet-markdown-report-path");
const strictFailureFleetReport = await readJsonReport(strictFailureOutputs["fleet-report-path"]);
const strictFailureFleetMarkdownReport = await readFile(
  strictFailureOutputs["fleet-markdown-report-path"],
  "utf8",
);
const strictFailureStepSummaryReport = await readFile(
  path.join(runnerTemp, "step-summary-strict-failure.md"),
  "utf8",
);
if (
  strictFailureFleetReport.summary?.warning !== 1 ||
  strictFailureFleetReport.summary?.total !== 1
) {
  throw new Error(
    `GitHub Action failed strict gate did not preserve parseable fleet JSON: ${JSON.stringify(
      strictFailureFleetReport,
    )}`,
  );
}
if (
  !strictFailureFleetMarkdownReport.includes("# GroundAtlas fleet adoption report") ||
  !strictFailureFleetMarkdownReport.includes("Summary: 0 adopted, 1 warning, 0 blocked, 1 total.")
) {
  throw new Error(
    `GitHub Action failed strict gate did not preserve fleet Markdown report:\n${strictFailureFleetMarkdownReport}`,
  );
}
if (
  !strictFailureStepSummaryReport.includes("Summary: 0 adopted, 1 warning, 0 blocked, 1 total.")
) {
  throw new Error(
    `GitHub Action failed strict gate did not preserve the fleet scorecard in the step summary:\n${strictFailureStepSummaryReport}`,
  );
}

console.log(
  JSON.stringify(
    {
      sourceLabel: "composite-action-packed-tarball-smoke",
      packageSpec: tarballPath,
      packageVersion: packageJson.version,
      fixture: fixtureCopy,
      trackedFixture: trackedFixtureCopy,
      strictFailureFixture: strictFailureFixtureCopy,
      outputDir: ".groundatlas-action-smoke",
      manifestReport: smokeOutputs["manifest-report-path"],
      fleetReport: smokeOutputs["fleet-report-path"],
      fleetMarkdownReport: smokeOutputs["fleet-markdown-report-path"],
      stepSummary: "fleet scorecard appended",
      trackedOutputDiffGate: "passed",
      strictFailureReports: "preserved",
    },
    null,
    2,
  ),
);
console.log("GitHub Action smoke passed.");

function extractRunBlock(actionText) {
  const lines = actionText.split("\n");
  const start = lines.findIndex((line) => line.trim() === "run: |");
  if (start === -1) return "";
  const block = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim().length > 0 && !line.startsWith("        ")) break;
    block.push(line.startsWith("        ") ? line.slice(8) : "");
  }
  return block.join("\n");
}

function runAction({
  packageSpec,
  workingDirectory,
  outputDir,
  failOnDiff,
  manifestReportPath = "",
  fleetReportPath = "",
  fleetMarkdownReportPath = "",
  strict = false,
  githubOutputPath,
  githubStepSummaryPath,
}) {
  return spawnSync("bash", ["-c", runBlock], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      GROUNDATLAS_PACKAGE_SPEC: packageSpec,
      GROUNDATLAS_WORKING_DIRECTORY: workingDirectory,
      GROUNDATLAS_OUTPUT_DIR: outputDir,
      GROUNDATLAS_UPDATE: "true",
      GROUNDATLAS_REQUIRE_ATLAS: "true",
      GROUNDATLAS_STRICT: strict ? "true" : "false",
      GROUNDATLAS_FAIL_ON_DIFF: failOnDiff ? "true" : "false",
      GROUNDATLAS_MANIFEST_REPORT_PATH: manifestReportPath,
      GROUNDATLAS_FLEET_REPORT_PATH: fleetReportPath,
      GROUNDATLAS_FLEET_MARKDOWN_REPORT_PATH: fleetMarkdownReportPath,
      RUNNER_TEMP: runnerTemp,
      ...(githubOutputPath ? { GITHUB_OUTPUT: githubOutputPath } : {}),
      ...(githubStepSummaryPath ? { GITHUB_STEP_SUMMARY: githubStepSummaryPath } : {}),
    },
  });
}

function assertActionPassed(result, message, fixture) {
  if (result.status === 0) return;
  throw new Error(
    [message, `packageSpec=${tarballPath}`, `fixture=${fixture}`, result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n"),
  );
}

async function writeNeutralProjectManifest(targetDir) {
  const manifest = {
    schemaVersion: 1,
    project: {
      id: "fixture-basic",
      name: "Fixture Basic",
      summary: "Fixture repository for GroundAtlas GitHub Action smoke tests.",
      lifecycle: "active",
      visibility: "open-source",
      repository: "https://github.com/SylphxAI/fixture-basic",
    },
    truth: {
      humanProjectFile: "PROJECT.md",
      agentAdapter: "AGENTS.md",
      adrs: ["docs/adr/"],
      source: ["src/"],
      tests: ["test/"],
    },
    surfaces: [{ type: "cli", name: "Fixture CLI", path: "package.json" }],
    commands: [{ name: "check", command: "bun test", purpose: "Run fixture tests." }],
    adoption: { status: "adopted" },
  };
  await writeFile(
    path.join(targetDir, "project.manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

async function writeAdoptedRepoEvidence(targetDir) {
  await mkdir(path.join(targetDir, ".github", "workflows"), { recursive: true });
  await mkdir(path.join(targetDir, "docs", "specs"), { recursive: true });
  await writeFile(
    path.join(targetDir, "README.md"),
    "# Fixture Basic\n\nPublic entry point for the adopted GroundAtlas action smoke fixture.\n",
  );
  await writeFile(
    path.join(targetDir, "SECURITY.md"),
    "# Security\n\nReport fixture security issues through the test harness.\n",
  );
  await writeFile(
    path.join(targetDir, "docs", "specs", "product.md"),
    "# Fixture Product Spec\n\nDefines the adopted smoke fixture boundary.\n",
  );
  await writeFile(
    path.join(targetDir, ".github", "workflows", "ci.yml"),
    [
      "name: Fixture CI",
      "on:",
      "  pull_request:",
      "  merge_group:",
      "  push:",
      "    branches: [main]",
      "jobs:",
      "  check:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout@v5",
      "      - run: bun test",
      "",
    ].join("\n"),
  );
}

async function readJsonReport(reportPath) {
  return JSON.parse(await readFile(reportPath, "utf8"));
}

function parseGithubOutput(outputText) {
  return Object.fromEntries(
    outputText
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator === -1) throw new Error(`Invalid GITHUB_OUTPUT line: ${line}`);
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function assertOutputPath(outputs, key, expectedPrefix) {
  const value = outputs[key];
  if (!value) {
    throw new Error(`GITHUB_OUTPUT missing ${key}: ${JSON.stringify(outputs)}`);
  }
  if (!path.isAbsolute(value)) {
    throw new Error(`GITHUB_OUTPUT ${key} must be absolute: ${value}`);
  }
  if (expectedPrefix && !value.startsWith(`${expectedPrefix}${path.sep}`)) {
    throw new Error(`GITHUB_OUTPUT ${key} should resolve from working-directory: ${value}`);
  }
}
