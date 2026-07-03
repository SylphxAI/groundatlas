import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { smokeInstalledPackage } from "./smoke-installed-package.mjs";

const registryUrl = process.env.GROUNDATLAS_NPM_REGISTRY ?? "https://registry.npmjs.org";
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const spec = `${packageJson.name}@${packageJson.version}`;
const expectedGitHead = process.env.GITHUB_SHA ?? gitHead();
const raw = await readRegistryWithRetry(spec);
const data = JSON.parse(raw);

const integrity = data.dist?.integrity ?? data["dist.integrity"];
const tarball = data.dist?.tarball ?? data["dist.tarball"];
const publishedGitHead = data.gitHead;

if (data.version !== packageJson.version || !integrity || !tarball) {
  console.error(`Registry readback for ${spec} is incomplete: ${raw}`);
  process.exit(1);
}
if (expectedGitHead && publishedGitHead !== expectedGitHead) {
  console.error(
    `Registry gitHead mismatch for ${spec}: expected ${expectedGitHead}, got ${publishedGitHead ?? "missing"}.`,
  );
  process.exit(1);
}

const smoke = smokeInstalledPackage({
  packageSpec: spec,
  sourceLabel: "npm-registry",
  expectedVersion: packageJson.version,
  registryUrl,
  emitEvidence: false,
  smokeStdio: ["ignore", "ignore", "inherit"],
});
const evidence = {
  schemaVersion: 1,
  sourceLabel: "npm-registry",
  packageSpec: spec,
  registryUrl,
  version: data.version,
  integrity,
  tarball,
  gitHead: publishedGitHead,
  expectedGitHead,
  smoke,
};
console.log(JSON.stringify(evidence, null, 2));

async function readRegistryWithRetry(packageSpec) {
  const attempts = Number(process.env.GROUNDATLAS_READBACK_ATTEMPTS ?? "12");
  const delayMs = Number(process.env.GROUNDATLAS_READBACK_DELAY_MS ?? "5000");
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return execFileSync(
        "npm",
        [
          "view",
          packageSpec,
          "version",
          "dist.integrity",
          "dist.tarball",
          "gitHead",
          "--json",
          "--registry",
          registryUrl,
        ],
        {
          encoding: "utf8",
        },
      );
    } catch (error) {
      lastError = error;
      const stderr = String(error.stderr ?? "");
      if (attempt === attempts || !(stderr.includes("E404") || stderr.includes("404 Not Found"))) {
        throw error;
      }
      console.error(
        `Registry readback attempt ${attempt}/${attempts} did not find ${packageSpec}; retrying in ${delayMs}ms.`,
      );
      await sleep(delayMs);
    }
  }
  throw lastError;
}

function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}
