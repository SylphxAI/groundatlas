import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const spec = `${packageJson.name}@${packageJson.version}`;

try {
  const existing = execFileSync("npm", ["view", spec, "version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  if (existing) {
    console.error(`${spec} already exists on npm; refusing to publish an immutable duplicate.`);
    process.exit(1);
  }
} catch (error) {
  const stderr = String(error.stderr ?? "");
  if (stderr.includes("E404") || stderr.includes("404 Not Found")) {
    console.log(`${spec} is not present on npm; publish preflight passed.`);
    process.exit(0);
  }
  throw error;
}
