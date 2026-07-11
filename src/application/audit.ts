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
import {
  rustScannerDelegationEnabled,
  scanRepositoryViaRust,
} from "../infrastructure/rustScanner.js";
import { scanRepository } from "./scan.js";

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
    issues.push(...(await auditFreshness(cwd, outputDir, atlas)));
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

async function auditFreshness(cwd: string, outputDir: string, atlas: AtlasMap): Promise<Risk[]> {
  try {
    const current = rustScannerDelegationEnabled()
      ? scanRepositoryViaRust({ cwd, outputDir })
      : await scanRepository({ cwd, outputDir });
    if (freshnessFingerprint(atlas) === freshnessFingerprint(current)) {
      return [];
    }
    return [
      {
        severity: "error",
        code: "stale-atlas",
        message: `${outputDir}/atlas.json does not match the current repository scan. Run ga update and commit or regenerate the output according to repo policy.`,
      },
    ];
  } catch (error) {
    return [
      {
        severity: "error",
        code: "freshness-scan-failed",
        message: `Could not verify generated map freshness: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    ];
  }
}

export function freshnessFingerprint(atlas: AtlasMap): string {
  return JSON.stringify({
    schemaVersion: atlas.schemaVersion,
    generator: atlas.generator,
    repository: {
      name: atlas.repository?.name,
      packageManager: atlas.repository?.packageManager,
    },
    policy: atlas.policy,
    truth: atlas.truth,
    orientation: atlas.orientation,
    sources: atlas.sources,
    publicSurfaces: atlas.publicSurfaces,
    validationCommands: atlas.validationCommands,
    risks: atlas.risks,
  });
}
