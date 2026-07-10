import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const readText = (relativePath: string): string =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("check-no-ts-init-backend gate script exists and enforces Rust init authority", () => {
  const script = readText("scripts/check-no-ts-init-backend.sh");

  expect(script).toContain("check-no-ts-init-backend");
  expect(script).toContain("rustScannerDelegationEnabled");
  expect(script).toContain("scanRepositoryViaRust");
  expect(script).toContain('GROUNDATLAS_RUST_SCANNER = "1"');
  expect(existsSync(new URL("../test/fixtures/basic/atlas.golden.json", import.meta.url).pathname)).toBe(
    true,
  );
  expect(existsSync(new URL("../test/initParity.test.ts", import.meta.url).pathname)).toBe(true);
});

test("published npm CLI init exports gate TS fallback behind Rust delegation", () => {
  const cli = readText("src/cli.ts");

  expect(cli).toContain('process.env.GROUNDATLAS_RUST_SCANNER = "1"');
  expect(cli).toContain("if (rustScannerDelegationEnabled())");
  expect(cli).toContain("scanRepositoryViaRust");

  const initBlock = cli.slice(cli.indexOf('if (args.command === "init")'));
  expect(initBlock).toContain("rustScannerDelegationEnabled");
  expect(initBlock).toContain("scanRepositoryViaRust");
});