import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const readText = (relativePath: string): string =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("check-no-ts-audit-backend gate script exists and enforces Rust audit freshness authority", () => {
  const script = readText("scripts/check-no-ts-audit-backend.sh");

  expect(script).toContain("check-no-ts-audit-backend");
  expect(script).toContain("rustScannerDelegationEnabled");
  expect(script).toContain("scanRepositoryViaRust");
  expect(script).toContain("auditFreshness");
  expect(existsSync(new URL("../test/auditParity.test.ts", import.meta.url).pathname)).toBe(true);
});

test("audit freshness exports gate TS fallback behind Rust delegation", () => {
  const audit = readText("src/application/audit.ts");

  expect(audit).toContain("rustScannerDelegationEnabled");
  expect(audit).toContain("scanRepositoryViaRust");
  expect(audit).toContain("async function auditFreshness");
});
