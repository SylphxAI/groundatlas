import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const expectedTag = `v${packageJson.version}`;
const actualTag =
  process.env.GITHUB_REF_TYPE === "tag"
    ? process.env.GITHUB_REF_NAME
    : process.env.GROUNDATLAS_RELEASE_TAG;

if (!actualTag) {
  console.log(`No release tag present; expected release tag would be ${expectedTag}.`);
  process.exit(0);
}

if (actualTag !== expectedTag) {
  console.error(
    `Release tag ${actualTag} does not match package version ${packageJson.version}. Expected ${expectedTag}.`,
  );
  process.exit(1);
}

console.log(`Release tag ${actualTag} matches package version ${packageJson.version}.`);
