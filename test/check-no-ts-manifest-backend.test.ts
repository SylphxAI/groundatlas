import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const readText = (relativePath: string): string =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("check-no-ts-manifest-backend gate script exists and enforces Rust manifest discovery authority", () => {
  const script = readText("scripts/check-no-ts-manifest-backend.sh");

  expect(script).toContain("check-no-ts-manifest-backend");
  expect(script).toContain("rustScannerDelegationEnabled");
  expect(script).toContain("scanRepositoryViaRust");
  expect(script).toContain(String.raw`args\.command === "manifest"`);
  expect(existsSync(new URL("../test/manifestParity.test.ts", import.meta.url).pathname)).toBe(
    true,
  );
});

test("manifest CLI discovery exports gate TS fallback behind Rust delegation", () => {
  const cli = readText("src/cli.ts");

  expect(cli).toContain("rustScannerDelegationEnabled");
  expect(cli).toContain("scanRepositoryViaRust");
  expect(cli).toContain('if (args.command === "manifest")');
});
