import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const spec = `${packageJson.name}@${packageJson.version}`;
const raw = execFileSync(
  "npm",
  ["view", spec, "version", "dist.integrity", "dist.tarball", "--json"],
  {
    encoding: "utf8",
  },
);
const data = JSON.parse(raw);

const integrity = data.dist?.integrity ?? data["dist.integrity"];
const tarball = data.dist?.tarball ?? data["dist.tarball"];

if (data.version !== packageJson.version || !integrity || !tarball) {
  console.error(`Registry readback for ${spec} is incomplete: ${raw}`);
  process.exit(1);
}

const temp = mkdtempSync(path.join(tmpdir(), "groundatlas-registry-smoke-"));
try {
  writeFileSync(path.join(temp, "package.json"), '{"type":"module"}\n');
  execFileSync("npm", ["install", spec], { cwd: temp, stdio: "inherit" });
  execFileSync(
    "node",
    [
      "-e",
      "import('groundatlas').then((m)=>{ if (!m.scanRepository || !m.auditAtlas) throw new Error('missing exports'); console.log('registry library smoke ok') })",
    ],
    { cwd: temp, stdio: "inherit" },
  );
  execFileSync(path.join(temp, "node_modules/.bin/groundatlas"), ["--help"], {
    cwd: temp,
    stdio: "ignore",
  });
  console.log(`Registry readback passed for ${spec}: ${integrity}`);
} finally {
  rmSync(temp, { force: true, recursive: true });
}
