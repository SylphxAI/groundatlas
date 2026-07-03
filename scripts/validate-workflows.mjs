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
  workflowText.includes("npm publish --access public --provenance"),
  "Release workflow must publish with npm provenance.",
);
assert(
  workflowText.includes("if: startsWith(github.ref, 'refs/tags/v')") &&
    (workflowText.match(/if: startsWith\(github\.ref, 'refs\/tags\/v'\)/g) ?? []).length >= 2,
  "Release workflow publish and readback must stay tag-gated.",
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
