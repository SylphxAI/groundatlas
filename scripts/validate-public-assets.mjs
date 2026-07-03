import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "schemas/project.manifest.schema.json",
  "examples/project.manifest.json",
  "docs/guides/user-guide.md",
  "docs/guides/dx-guide.md",
  "docs/guides/agent-guide.md",
  "docs/guides/manifest-guide.md",
  "docs/specs/open-source-strategy.md",
  "docs/specs/control-plane-business-case.md",
  "docs/specs/multi-project-control-plane.md",
  "docs/website/index.html",
];

const errors = [];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

for (const file of requiredFiles) {
  if (!(await exists(file))) errors.push(`Missing public asset: ${file}`);
}

const schema = JSON.parse(await readFile("schemas/project.manifest.schema.json", "utf8"));
const example = JSON.parse(await readFile("examples/project.manifest.json", "utf8"));
const readme = await readFile("README.md", "utf8");
const website = await readFile("docs/website/index.html", "utf8");

if (schema.title !== "Project Manifest") {
  errors.push("Project manifest schema title is incorrect.");
}
if (example.schemaVersion !== 1) {
  errors.push("Example project manifest must use schemaVersion 1.");
}
for (const field of ["id", "name", "summary", "lifecycle"]) {
  if (!example.project?.[field]) errors.push(`Example project manifest missing project.${field}.`);
}
if (!readme.includes("project.manifest.json")) {
  errors.push("README must document the canonical vendor-neutral project control file.");
}
if (!readme.includes("60-second demo")) {
  errors.push("README must include the 60-second demo section.");
}
if (!readme.includes("Roadmap (not yet shipped)")) {
  errors.push("README must separate roadmap from shipped features.");
}
if (/\.doctrine\/project\.json` \| Yes/.test(readme)) {
  errors.push("README must not make .doctrine/project.json the public required default.");
}
if (!readme.includes("Open-source promise")) {
  errors.push("README must include the open-source promise section.");
}
if (!website.includes("Vendor-neutral by design")) {
  errors.push("Website must explain the vendor-neutral position.");
}
for (const requiredWebsiteLink of [
  "https://github.com/SylphxAI/groundatlas#readme",
  "https://github.com/SylphxAI/groundatlas/blob/main/docs/guides/user-guide.md",
  "https://github.com/SylphxAI/groundatlas/blob/main/docs/guides/agent-guide.md",
  "https://github.com/SylphxAI/groundatlas/blob/main/docs/guides/manifest-guide.md",
  "https://github.com/SylphxAI/groundatlas/blob/main/schemas/project.manifest.schema.json",
]) {
  if (!website.includes(requiredWebsiteLink)) {
    errors.push(`Website missing required public link: ${requiredWebsiteLink}`);
  }
}
if (!website.includes("After npm registry publish/readback")) {
  errors.push("Website install snippet must not claim npm installation before registry readback.");
}
if (!readme.includes("https://sylphxai.github.io/groundatlas/")) {
  errors.push("README must expose the public website URL.");
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Public asset validation passed.");
}
