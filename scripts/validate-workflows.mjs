import { readFile } from "node:fs/promises";

const workflowPaths = [
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml",
  ".github/workflows/release.yml",
];
const docsPaths = ["README.md", "docs/guides/github-action.md"];
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

const workflowText = (await Promise.all(workflowPaths.map((path) => readFile(path, "utf8")))).join(
  "\n---\n",
);
const docsText = (await Promise.all(docsPaths.map((path) => readFile(path, "utf8")))).join(
  "\n---\n",
);
const allText = `${workflowText}\n---\n${docsText}`;
const releaseTagEnvLine = "GROUNDATLAS_RELEASE_TAG: $" + "{{ inputs.release_tag }}";
const githubShaRefLine = "ref: $" + "{{ github.sha }}";
const npmTokenEnvLine = "NODE_AUTH_TOKEN: $" + "{{ secrets.NPM_TOKEN }}";

for (const deprecated of [
  "actions/checkout@v4",
  "actions/setup-node@v4",
  "actions/upload-artifact@v4",
  "actions/configure-pages@v5",
  "actions/upload-pages-artifact@v3",
  "actions/deploy-pages@v4",
]) {
  assert(!allText.includes(deprecated), `Deprecated GitHub Action runtime remains: ${deprecated}`);
}

for (const required of [
  "actions/checkout@v5",
  "actions/setup-node@v5",
  "actions/upload-artifact@v5",
  "actions/configure-pages@v6",
  "actions/upload-pages-artifact@v4",
  "actions/deploy-pages@v5",
]) {
  assert(
    workflowText.includes(required),
    `Workflow missing Node 24 compatible action: ${required}`,
  );
}
assert(docsText.includes("actions/upload-artifact@v5"), "Docs must use upload-artifact@v5.");
assert(
  workflowText.includes("external-dogfood:") &&
    workflowText.includes("GROUNDATLAS_DOGFOOD_REPORT_PATH") &&
    workflowText.includes("scripts/assert-dogfood-report.mjs") &&
    workflowText.includes("name: groundatlas-external-dogfood"),
  "CI must keep machine-readable external dogfood evidence and assertions.",
);
assert(
  workflowText.includes("repository: SylphxAI/groundatlas") &&
    workflowText.includes("path: .dogfood-targets/groundatlas"),
  "CI external dogfood must use a public checkout target instead of a private credentialed repo.",
);
assert(
  workflowText.includes("groundatlas-npm-readback.json") &&
    workflowText.includes("set -euo pipefail") &&
    workflowText.includes("scripts/assert-json-file.mjs") &&
    workflowText.includes("groundatlas-post-publish-dogfood.json") &&
    workflowText.includes("name: groundatlas-release-evidence"),
  "Release workflow must upload parseable npm readback and post-publish dogfood evidence artifacts.",
);
assert(
  workflowText.includes("GROUNDATLAS_DOGFOOD_PACKAGE_SPEC") &&
    workflowText.includes("GROUNDATLAS_DOGFOOD_REPORT_PATH") &&
    workflowText.includes("--expect-post-publish"),
  "Release workflow must assert post-publish npm-registry dogfood evidence.",
);
assert(
  workflowText.includes("path: .dogfood-targets/groundatlas-release") &&
    workflowText.includes(githubShaRefLine),
  "Release post-publish dogfood must use a fresh checkout at the release commit.",
);
assert(
  workflowText.includes("npm publish --access public --provenance"),
  "Release workflow must publish with npm provenance.",
);
assert(
  workflowText.includes(npmTokenEnvLine),
  "Release workflow must use the org npm publish token until trusted publishing is configured for the first package.",
);
assert(
  workflowText.includes("if: startsWith(github.ref, 'refs/tags/v')") &&
    (workflowText.match(/if: startsWith\(github\.ref, 'refs\/tags\/v'\)/g) ?? []).length >= 5 &&
    workflowText.includes("if: always() && startsWith(github.ref, 'refs/tags/v')"),
  "Release workflow publish, readback, post-publish dogfood, and release evidence upload must stay tag-gated.",
);
assert(
  workflowText.includes(releaseTagEnvLine),
  "Release workflow dispatch must remain dry-run preflight only.",
);
assert(
  workflowText.includes("id-token: write") &&
    workflowText.includes('registry-url: "https://registry.npmjs.org"'),
  "Release workflow must keep trusted-publishing OIDC and npm registry configuration.",
);

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Workflow validation passed.");
}
