import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const readText = (relativePath: string): string =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("check-no-ts-update-backend gate script exists and enforces Rust update authority", () => {
  const script = readText("scripts/check-no-ts-update-backend.sh");

  expect(script).toContain("check-no-ts-update-backend");
  expect(script).toContain("rustScannerDelegationEnabled");
  expect(script).toContain("scanRepositoryViaRust");
  expect(script).toContain('GROUNDATLAS_RUST_SCANNER = "1"');
  expect(
    existsSync(new URL("../test/fixtures/basic/atlas.golden.json", import.meta.url).pathname),
  ).toBe(true);
  expect(existsSync(new URL("../test/updateParity.test.ts", import.meta.url).pathname)).toBe(true);
});

test("published npm CLI update exports gate TS fallback behind Rust delegation", () => {
  const cli = readText("src/cli.ts");

  expect(cli).toContain('process.env.GROUNDATLAS_RUST_SCANNER = "1"');
  expect(cli).toContain("if (rustScannerDelegationEnabled())");
  expect(cli).toContain("scanRepositoryViaRust");

  const updateBlock = cli.slice(cli.indexOf('if (args.command === "update")'));
  expect(updateBlock).toContain("rustScannerDelegationEnabled");
  expect(updateBlock).toContain("scanRepositoryViaRust");
});
