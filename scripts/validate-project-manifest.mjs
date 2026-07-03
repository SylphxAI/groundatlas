import { readFile } from "node:fs/promises";

import { validateProjectManifestFile } from "../src/application/projectManifest.ts";

const doctrineManifest = JSON.parse(await readFile(".doctrine/project.json", "utf8"));
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

async function assertManifestValid(path) {
  const report = await validateProjectManifestFile(path, path);
  if (!report.valid) {
    for (const issue of report.issues) {
      errors.push(issue.message);
    }
  }
}

await assertManifestValid("project.manifest.json");
await assertManifestValid(".doctrine/project.json");

assert(doctrineManifest.schemaVersion === 1, "schemaVersion must be 1");
assert(
  doctrineManifest.project?.repo === "SylphxAI/groundatlas",
  "project.repo must identify SylphxAI/groundatlas",
);
assert(doctrineManifest.project?.lifecycle, "project.lifecycle is required");
assert(
  Array.isArray(doctrineManifest.project?.goals) && doctrineManifest.project.goals.length > 0,
  "project.goals required",
);
assert(
  Array.isArray(doctrineManifest.project?.nonGoals) && doctrineManifest.project.nonGoals.length > 0,
  "project.nonGoals required",
);
assert(
  Array.isArray(doctrineManifest.boundaries?.owns) && doctrineManifest.boundaries.owns.length > 0,
  "boundaries.owns required",
);
assert(
  Array.isArray(doctrineManifest.boundaries?.doesNotOwn) &&
    doctrineManifest.boundaries.doesNotOwn.length > 0,
  "boundaries.doesNotOwn required",
);
assert(
  Array.isArray(doctrineManifest.boundaries?.forbiddenCouplings) &&
    doctrineManifest.boundaries.forbiddenCouplings.length > 0,
  "forbiddenCouplings required",
);
assert(
  doctrineManifest.documentation?.catalog?.path === ".doctrine/project.json",
  "documentation.catalog must point to manifest",
);
assert(
  Array.isArray(doctrineManifest.delivery?.requiredContexts),
  "delivery.requiredContexts required",
);
assert(doctrineManifest.adoption?.status, "adoption.status required");
for (const gap of doctrineManifest.adoption?.gaps ?? []) {
  assert(
    gap.id && gap.owner && gap.target,
    `gap ${gap.id ?? "unknown"} must include id, owner, target`,
  );
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Project manifest validation passed.");
}
