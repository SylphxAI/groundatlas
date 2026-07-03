import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { smokeInstalledPackage } from "./smoke-installed-package.mjs";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const temp = mkdtempSync(path.join(tmpdir(), "groundatlas-pack-smoke-"));
try {
  const packName = execFileSync("npm", ["pack", "--pack-destination", temp], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  })
    .trim()
    .split("\n")
    .at(-1);

  if (!packName) {
    throw new Error("npm pack did not return a tarball name");
  }

  smokeInstalledPackage({
    packageSpec: path.join(temp, packName),
    sourceLabel: "packed-local-tarball",
    expectedVersion: packageJson.version,
  });
  console.log("Packed package smoke passed.");
} finally {
  rmSync(temp, { force: true, recursive: true });
}
