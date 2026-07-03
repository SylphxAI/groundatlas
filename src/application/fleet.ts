import { stat } from "node:fs/promises";
import path from "node:path";

import {
  AGENT_ADAPTER_PATHS,
  DEFAULT_OUTPUT_DIR,
  type FleetAdoptionStatus,
  type FleetProjectReport,
  type FleetReport,
  MACHINE_PROJECT_MANIFEST_PATHS,
  type Risk,
} from "../domain/types.js";
import { pathExists } from "../infrastructure/fs.js";
import { auditAtlas } from "./audit.js";
import { loadConfig } from "./config.js";
import { scanRepository } from "./scan.js";

const DOGFOOD_BLOCKING_RISK_CODES = new Set([
  "missing-project-md",
  "missing-machine-project-manifest",
  "missing-agent-adapter",
  "missing-validation-commands",
]);

export type InspectFleetOptions = {
  cwd: string;
  paths: string[];
  outputDir?: string;
  requireAtlas?: boolean;
  strict?: boolean;
  now?: Date;
};

export async function inspectFleet(options: InspectFleetOptions): Promise<FleetReport> {
  const root = path.resolve(options.cwd);
  const projects = await Promise.all(
    normalizedFleetPaths(root, options.paths).map((projectPath) =>
      inspectFleetProject(projectPath, {
        outputDir: options.outputDir,
        requireAtlas: options.requireAtlas === true,
        now: options.now,
      }),
    ),
  );

  return {
    schemaVersion: 1,
    generatedAt: (options.now ?? new Date()).toISOString(),
    root,
    policy: {
      generatedAtlasRequired: options.requireAtlas === true,
      strict: options.strict === true,
      generatedArtifactsAre: "navigation-only",
    },
    summary: summarizeFleet(projects),
    projects: projects.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

function normalizedFleetPaths(root: string, values: string[]): string[] {
  const requested = values.length > 0 ? values : ["."];
  return [...new Set(requested.map((value) => path.resolve(root, value)))];
}

async function inspectFleetProject(
  projectPath: string,
  options: {
    outputDir?: string;
    requireAtlas: boolean;
    now?: Date;
  },
): Promise<FleetProjectReport> {
  const name = path.basename(projectPath);
  const issues: Risk[] = [];

  try {
    const projectStat = await stat(projectPath);
    if (!projectStat.isDirectory()) {
      return blockedProject(projectPath, name, options.outputDir, {
        severity: "error",
        code: "fleet-path-not-directory",
        message: `${projectPath} is not a directory.`,
      });
    }
  } catch (error) {
    return blockedProject(projectPath, name, options.outputDir, {
      severity: "error",
      code: "fleet-path-unreadable",
      message: `Could not read ${projectPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }

  try {
    const config = await loadConfig(projectPath, options.outputDir);
    const atlas = await scanRepository({
      cwd: projectPath,
      outputDir: config.outputDir,
      now: options.now,
    });
    const sourcePaths = new Set(atlas.sources.map((source) => source.path));
    const hasProjectFile = sourcePaths.has("PROJECT.md");
    const hasMachineManifest = hasAny(sourcePaths, (sourcePath) =>
      MACHINE_PROJECT_MANIFEST_PATHS.includes(
        sourcePath as (typeof MACHINE_PROJECT_MANIFEST_PATHS)[number],
      ),
    );
    const hasAgentAdapter = hasAny(sourcePaths, (sourcePath) =>
      AGENT_ADAPTER_PATHS.includes(sourcePath as (typeof AGENT_ADAPTER_PATHS)[number]),
    );
    const hasValidationCommands = atlas.validationCommands.length > 0;
    const generatedAtlasPath = path.join(projectPath, config.outputDir, "atlas.json");
    const generatedAtlasPresent = await pathExists(generatedAtlasPath);

    issues.push(...atlas.risks);

    let generatedAtlasChecked = false;
    let generatedAtlasOk = !options.requireAtlas;
    if (generatedAtlasPresent || options.requireAtlas) {
      generatedAtlasChecked = true;
      const audit = await auditAtlas(projectPath, config.outputDir);
      generatedAtlasOk = audit.ok;
      issues.push(...audit.issues);
    } else {
      issues.push({
        severity: "warning",
        code: "generated-atlas-not-checked",
        message:
          "Generated atlas was not found; run ga update and ga audit before claiming full dogfooding adoption.",
      });
    }

    if (options.requireAtlas && !generatedAtlasPresent) {
      issues.push({
        severity: "error",
        code: "missing-required-generated-atlas",
        message: `${config.outputDir}/atlas.json is required for this fleet gate.`,
      });
    }

    const status = adoptionStatus(issues);

    return {
      path: projectPath,
      name: atlas.repository.name,
      status,
      outputDir: config.outputDir,
      hasProjectFile,
      hasMachineManifest,
      hasAgentAdapter,
      hasValidationCommands,
      generatedAtlas: {
        required: options.requireAtlas,
        checked: generatedAtlasChecked,
        present: generatedAtlasPresent,
        ok: generatedAtlasOk,
      },
      validationCommands: atlas.validationCommands,
      issues: uniqueIssues(issues),
    };
  } catch (error) {
    return blockedProject(projectPath, name, options.outputDir, {
      severity: "error",
      code: "fleet-scan-failed",
      message: `Could not scan ${projectPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
}

function blockedProject(
  projectPath: string,
  name: string,
  outputDir: string | undefined,
  issue: Risk,
): FleetProjectReport {
  return {
    path: projectPath,
    name,
    status: "blocked",
    outputDir: outputDir ?? DEFAULT_OUTPUT_DIR,
    hasProjectFile: false,
    hasMachineManifest: false,
    hasAgentAdapter: false,
    hasValidationCommands: false,
    generatedAtlas: {
      required: false,
      checked: false,
      present: false,
      ok: false,
    },
    validationCommands: [],
    issues: [issue],
  };
}

function adoptionStatus(issues: Risk[]): FleetAdoptionStatus {
  const blocking = issues.some(
    (issue) => issue.severity === "error" || DOGFOOD_BLOCKING_RISK_CODES.has(issue.code),
  );
  if (blocking) return "blocked";
  if (issues.length > 0) return "warning";
  return "adopted";
}

function summarizeFleet(projects: FleetProjectReport[]): FleetReport["summary"] {
  const summary: FleetReport["summary"] = {
    adopted: 0,
    warning: 0,
    blocked: 0,
    total: projects.length,
  };
  for (const project of projects) {
    summary[project.status] += 1;
  }
  return summary;
}

function hasAny(sourcePaths: Set<string>, predicate: (sourcePath: string) => boolean): boolean {
  return [...sourcePaths].some(predicate);
}

function uniqueIssues(issues: Risk[]): Risk[] {
  const seen = new Set<string>();
  const result: Risk[] = [];
  for (const issue of issues) {
    const key = `${issue.severity}:${issue.code}:${issue.source ?? ""}:${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(issue);
  }
  return result.sort(compareIssues);
}

function compareIssues(left: Risk, right: Risk): number {
  const severityRank: Record<Risk["severity"], number> = { error: 0, warning: 1, info: 2 };
  const severityCompare = severityRank[left.severity] - severityRank[right.severity];
  return severityCompare === 0 ? left.code.localeCompare(right.code) : severityCompare;
}
