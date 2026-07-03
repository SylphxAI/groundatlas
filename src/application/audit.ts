import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  ATLAS_SCHEMA_VERSION,
  type AtlasMap,
  type AuditResult,
  GENERATED_BANNER,
  type Risk,
} from "../domain/types.js";
import { pathExists, readJsonFile } from "../infrastructure/fs.js";

export async function auditAtlas(cwd: string, outputDir: string): Promise<AuditResult> {
  const issues: Risk[] = [];
  const outputRoot = path.join(cwd, outputDir);
  const atlasPath = path.join(outputRoot, "atlas.json");
  const atlas = await readJsonFile<AtlasMap>(atlasPath);

  if (!atlas) {
    issues.push({
      severity: "error",
      code: "missing-atlas-json",
      message: `${outputDir}/atlas.json is missing or invalid.`,
    });
  } else {
    if (atlas.schemaVersion !== ATLAS_SCHEMA_VERSION) {
      issues.push({
        severity: "error",
        code: "invalid-atlas-schema-version",
        message: `${outputDir}/atlas.json uses schemaVersion ${atlas.schemaVersion}.`,
      });
    }
    if (atlas.policy.generatedDocsAreNotSsot !== true) {
      issues.push({
        severity: "error",
        code: "missing-non-ssot-policy",
        message: "Atlas policy must state generated docs are not SSOT.",
      });
    }
    issues.push(...atlas.risks.filter((risk) => risk.severity === "error"));
  }

  for (const markdown of ["README.md", "source-map.md", "change-guide.md"]) {
    const filePath = path.join(outputRoot, markdown);
    if (!(await pathExists(filePath))) {
      issues.push({
        severity: "error",
        code: "missing-generated-markdown",
        message: `${outputDir}/${markdown} is missing.`,
      });
      continue;
    }
    const content = await readFile(filePath, "utf8");
    if (!content.includes(GENERATED_BANNER)) {
      issues.push({
        severity: "error",
        code: "missing-generated-banner",
        message: `${outputDir}/${markdown} does not declare the generated non-SSOT boundary.`,
      });
    }
  }

  return { ok: !issues.some((issue) => issue.severity === "error"), issues };
}
