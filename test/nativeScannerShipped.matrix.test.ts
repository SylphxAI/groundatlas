import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = join(import.meta.dir, "..");

describe("native scanner shipped in npm pack (adversarial)", () => {
  it("resolve path prefers bin/native", () => {
    const src = readFileSync(join(root, "src/infrastructure/rustScanner.ts"), "utf8");
    expect(src).toContain('bin/native/groundatlas-scanner');
    expect(src.indexOf("bin/native")).toBeLessThan(src.indexOf("target/release"));
  });

  it("package files include bin", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.files).toContain("bin");
  });

  it("staged binary exists after stage:rust", () => {
    const r = spawnSync("bun", ["scripts/stage-rust-scanner.ts"], { cwd: root, encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(existsSync(join(root, "bin/native/groundatlas-scanner"))).toBe(true);
  });

  it("check-native-scanner-shipped passes", () => {
    const r = spawnSync("bash", ["scripts/check-native-scanner-shipped.sh"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PASS");
  });
});
