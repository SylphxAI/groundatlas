import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import packageJson from "../package.json" with { type: "json" };

const action = await readFile("action.yml", "utf8");
const guide = await readFile("docs/guides/github-action.md", "utf8");
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

for (const required of [
  "name: GroundAtlas Fleet Gate",
  "using: composite",
  "package-spec:",
  "working-directory:",
  "output-dir:",
  "require-atlas:",
  "strict:",
  "fail-on-diff:",
  "manifest-report-path:",
  "fleet-report-path:",
  "fleet-markdown-report-path:",
  "npm exec --yes --package",
  "Node.js >=20.11",
  "ga update",
  "manifest --out",
  "ga audit",
  "fleet",
  "PIPESTATUS",
  "capture_text_report",
  "publish_report",
  "publish_step_summary",
  "GITHUB_OUTPUT",
  "GITHUB_STEP_SUMMARY",
]) {
  assert(action.includes(required), `action.yml missing required content: ${required}`);
}

assert(
  action.includes(`default: groundatlas@${packageJson.version}`),
  "action.yml package-spec default must match this package version for tag/package provenance.",
);
assert(
  !/groundatlas@latest/.test(action),
  "action.yml must not default to groundatlas@latest because that breaks pinned action provenance.",
);
assert(
  !/\.doctrine\/project\.json/.test(action),
  "action.yml must not make Doctrine a public default.",
);
assert(
  !/local-cli|GROUNDATLAS_LOCAL_CLI/.test(action),
  "action.yml must not expose a local CLI bypass in the public action contract.",
);

const actionRunBlock = extractRunBlock(action);
assert(actionRunBlock.length > 0, "action.yml must include a composite run block.");
const bashCheck = spawnSync("bash", ["-n"], {
  encoding: "utf8",
  input: actionRunBlock,
});
assert(
  bashCheck.status === 0,
  `action.yml run block is not valid bash: ${bashCheck.stderr.trim()}`,
);

for (const required of [
  "Publication boundary",
  `groundatlas@${packageJson.version}`,
  "project.manifest.json",
  ".doctrine/project.json",
  "pre-publish confidence",
  "Do not claim fleet package adoption",
  "No local binary bypass",
  "not use `groundatlas@latest`",
  "manifest-report-path",
  "fleet-markdown-report-path",
  "GITHUB_STEP_SUMMARY",
  "steps.groundatlas.outputs.manifest-report-path",
  "steps.groundatlas.outputs.fleet-report-path",
  "steps.groundatlas.outputs.fleet-markdown-report-path",
  "upload-artifact",
]) {
  assert(guide.includes(required), `GitHub Action guide missing required boundary: ${required}`);
}

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

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("GitHub Action validation passed.");
}
