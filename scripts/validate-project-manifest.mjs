import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(".doctrine/project.json", "utf8"));
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

assert(manifest.schemaVersion === 1, "schemaVersion must be 1");
assert(
  manifest.project?.repo === "SylphxAI/groundatlas",
  "project.repo must identify SylphxAI/groundatlas",
);
assert(manifest.project?.lifecycle, "project.lifecycle is required");
assert(
  Array.isArray(manifest.project?.goals) && manifest.project.goals.length > 0,
  "project.goals required",
);
assert(
  Array.isArray(manifest.project?.nonGoals) && manifest.project.nonGoals.length > 0,
  "project.nonGoals required",
);
assert(
  Array.isArray(manifest.boundaries?.owns) && manifest.boundaries.owns.length > 0,
  "boundaries.owns required",
);
assert(
  Array.isArray(manifest.boundaries?.doesNotOwn) && manifest.boundaries.doesNotOwn.length > 0,
  "boundaries.doesNotOwn required",
);
assert(
  Array.isArray(manifest.boundaries?.forbiddenCouplings) &&
    manifest.boundaries.forbiddenCouplings.length > 0,
  "forbiddenCouplings required",
);
assert(
  manifest.documentation?.catalog?.path === ".doctrine/project.json",
  "documentation.catalog must point to manifest",
);
assert(Array.isArray(manifest.delivery?.requiredContexts), "delivery.requiredContexts required");
assert(manifest.adoption?.status, "adoption.status required");
for (const gap of manifest.adoption?.gaps ?? []) {
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
