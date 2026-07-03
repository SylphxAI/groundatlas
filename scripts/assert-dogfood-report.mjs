import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const reportPath =
  args.find((arg) => !arg.startsWith("--")) ?? process.env.GROUNDATLAS_DOGFOOD_REPORT_PATH;
const expectPreNpm = args.includes("--expect-pre-npm");
const expectAdopted = args.includes("--expect-adopted");
const expectNeutralManifest = args.includes("--expect-neutral-manifest");
const expectDoctrineAdapter = args.includes("--expect-doctrine-adapter");

if (!reportPath) {
  console.error(
    "Usage: node scripts/assert-dogfood-report.mjs <report.json> [--expect-pre-npm] [--expect-adopted] [--expect-neutral-manifest] [--expect-doctrine-adapter]",
  );
  process.exit(1);
}

const report = JSON.parse(await readFile(reportPath, "utf8"));
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

assert(report.schemaVersion === 1, "Dogfood report schemaVersion must be 1.");
assert(Array.isArray(report.repositories), "Dogfood report must include repositories[].");
assert(report.repositories?.length > 0, "Dogfood report must include at least one repository.");
assert(!report.error, `Dogfood report captured an error: ${report.error}`);

if (expectPreNpm) {
  assert(
    report.claimBoundary === "pre-npm-pilot-only",
    `Expected claimBoundary=pre-npm-pilot-only, got ${report.claimBoundary}.`,
  );
  assert(
    report.groundatlasPackageSource === "packed-local-tarball",
    `Expected groundatlasPackageSource=packed-local-tarball, got ${report.groundatlasPackageSource}.`,
  );
  assert(
    typeof report.packageSpec === "string" && report.packageSpec.endsWith(".tgz"),
    `Expected packed tarball packageSpec before npm publish, got ${report.packageSpec}.`,
  );
}

for (const [index, repo] of (report.repositories ?? []).entries()) {
  const label = repo.targetRepo ?? `repositories[${index}]`;
  assert(repo.scanOk === true, `${label}: scanOk must be true.`);
  assert(repo.auditOk === true, `${label}: auditOk must be true.`);
  assert(repo.manifestValidationOk === true, `${label}: manifestValidationOk must be true.`);
  assert(repo.fleetCommandOk === true, `${label}: fleetCommandOk must be true.`);
  assert(repo.mutatedOriginalRepo === false, `${label}: original repository must not be mutated.`);
  assert(
    repo.originalRepoStatusBefore === repo.originalRepoStatusAfter,
    `${label}: original repository status changed.`,
  );
  assert(
    repo.groundatlasPackageSource === report.groundatlasPackageSource,
    `${label}: repository package source must match top-level evidence.`,
  );

  if (expectAdopted) {
    assert(
      repo.fleetStatus === "adopted",
      `${label}: expected fleetStatus=adopted, got ${repo.fleetStatus}.`,
    );
    assert(
      Array.isArray(repo.fleetIssues) && repo.fleetIssues.length === 0,
      `${label}: expected no fleet issues.`,
    );
  }

  if (expectNeutralManifest) {
    assert(
      repo.detectedProjectManifest === "project.manifest.json",
      `${label}: expected detectedProjectManifest=project.manifest.json, got ${repo.detectedProjectManifest}.`,
    );
    assert(
      repo.manifestValidation?.path === "project.manifest.json" &&
        repo.manifestValidation?.adapter === false &&
        repo.manifestValidation?.valid === true,
      `${label}: expected valid neutral manifest validation.`,
    );
    assert(
      repo.fleetManifest?.path === "project.manifest.json" &&
        repo.fleetManifest?.adapter === false &&
        repo.fleetManifest?.valid === true,
      `${label}: expected fleet selected manifest to be valid project.manifest.json.`,
    );
  }

  if (expectDoctrineAdapter) {
    assert(
      Array.isArray(repo.fleetManifestAdapters) &&
        repo.fleetManifestAdapters.some(
          (adapter) => adapter.path === ".doctrine/project.json" && adapter.adapter === true,
        ),
      `${label}: expected .doctrine/project.json to be reported as an adapter.`,
    );
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Dogfood report assertion passed: ${path.resolve(reportPath)}`);
