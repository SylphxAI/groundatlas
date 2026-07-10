import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const readText = (relativePath: string): string =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("check-no-ts-impact-backend gate script exists and enforces Rust impact authority", () => {
  const script = readText("scripts/check-no-ts-impact-backend.sh");

  expect(script).toContain("check-no-ts-impact-backend");
  expect(script).toContain("rustScannerDelegationEnabled");
  expect(script).toContain("scanRepositoryViaRust");
  expect(script).toContain('args.command === "impact"');
  expect(existsSync(new URL("../test/impactParity.test.ts", import.meta.url).pathname)).toBe(true);
});

test("published npm CLI impact exports gate TS fallback behind Rust delegation", () => {
  const cli = readText("src/cli.ts");

  expect(cli).toContain('process.env.GROUNDATLAS_RUST_SCANNER = "1"');
  expect(cli).toContain("if (rustScannerDelegationEnabled())");
  expect(cli).toContain("scanRepositoryViaRust");

  const impactBlock = cli.slice(cli.indexOf('if (args.command === "impact")'));
  expect(impactBlock).toContain("rustScannerDelegationEnabled");
  expect(impactBlock).toContain("scanRepositoryViaRust");
});