import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const readText = (relativePath: string): string =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("check-no-ts-scan-backend gate script exists and enforces Rust scan authority", () => {
  const script = readText("scripts/check-no-ts-scan-backend.sh");

  expect(script).toContain("check-no-ts-scan-backend");
  expect(script).toContain("rustScannerDelegationEnabled");
  expect(script).toContain("scanRepositoryViaRust");
  expect(script).toContain('GROUNDATLAS_RUST_SCANNER = "1"');
  expect(existsSync(new URL("../test/fixtures/basic/atlas.golden.json", import.meta.url).pathname)).toBe(
    true,
  );
  expect(existsSync(new URL("../test/scanParity.test.ts", import.meta.url).pathname)).toBe(true);
});

test("published npm CLI scan exports gate TS fallback behind Rust delegation", () => {
  const cli = readText("src/cli.ts");
  const rustScanner = readText("src/infrastructure/rustScanner.ts");

  expect(cli).toContain('process.env.GROUNDATLAS_RUST_SCANNER = "1"');
  expect(cli).toContain("if (rustScannerDelegationEnabled())");
  expect(cli).toContain("scanRepositoryViaRust");
  expect(rustScanner).toContain("if (!flag)");
  expect(rustScanner).toContain('flag === "ts"');
});