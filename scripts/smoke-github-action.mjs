import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import packageJson from "../package.json" with { type: "json" };

const root = process.cwd();
const distCli = path.join(root, "dist", "cli.js");
const tempRoot = await mkdtemp(path.join(tmpdir(), "groundatlas-action-smoke-"));
const packDir = path.join(tempRoot, "package");
const runnerTemp = path.join(tempRoot, "runner");
const fixtureCopy = path.join(tempRoot, "fixture-basic");

await mkdir(packDir, { recursive: true });
await mkdir(runnerTemp, { recursive: true });
await cp(path.join(root, "test", "fixtures", "basic"), fixtureCopy, {
  recursive: true,
  force: true,
});

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

const smoke = spawnSync("bash", ["-c", runBlock], {
  cwd: root,
  encoding: "utf8",
  env: {
    ...process.env,
    GROUNDATLAS_PACKAGE_SPEC: tarballPath,
    GROUNDATLAS_WORKING_DIRECTORY: fixtureCopy,
    GROUNDATLAS_OUTPUT_DIR: ".groundatlas-action-smoke",
    GROUNDATLAS_UPDATE: "true",
    GROUNDATLAS_REQUIRE_ATLAS: "true",
    GROUNDATLAS_STRICT: "false",
    GROUNDATLAS_FAIL_ON_DIFF: "false",
    RUNNER_TEMP: runnerTemp,
  },
});

if (smoke.status !== 0) {
  throw new Error(
    [
      "GitHub Action smoke failed.",
      `packageSpec=${tarballPath}`,
      `fixture=${fixtureCopy}`,
      smoke.stdout,
      smoke.stderr,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

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

if (!tarballName.includes(`${packageJson.version}.tgz`)) {
  throw new Error(
    `Packed tarball ${tarballName} does not match package version ${packageJson.version}.`,
  );
}

console.log(
  JSON.stringify(
    {
      sourceLabel: "composite-action-packed-tarball-smoke",
      packageSpec: tarballPath,
      packageVersion: packageJson.version,
      fixture: fixtureCopy,
      outputDir: ".groundatlas-action-smoke",
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
