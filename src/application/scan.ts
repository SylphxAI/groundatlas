import path from "node:path";
import packageJson from "../../package.json" with { type: "json" };

import { classifySource } from "../domain/classify.js";
import {
  ATLAS_SCHEMA_VERSION,
  type AtlasMap,
  type PublicSurface,
  type Risk,
  type ScanOptions,
  type ValidationCommand,
} from "../domain/types.js";
import { readJsonFile, walkFiles } from "../infrastructure/fs.js";
import { readGitState } from "../infrastructure/git.js";

const { version } = packageJson;

type PackageJson = {
  name?: string;
  bin?: string | Record<string, string>;
  exports?: unknown;
  scripts?: Record<string, string>;
};

export async function scanRepository(options: ScanOptions): Promise<AtlasMap> {
  const cwd = path.resolve(options.cwd);
  const [git, files, packageJson] = await Promise.all([
    readGitState(cwd),
    walkFiles(cwd, options.outputDir),
    readJsonFile<PackageJson>(path.join(cwd, "package.json")),
  ]);

  const sources = files.map((file) => classifySource(file.path, file.sizeBytes));
  const sourcePaths = new Set(sources.map((source) => source.path));
  const validationCommands = inferValidationCommands(packageJson);
  const risks = inferRisks(sourcePaths, validationCommands);
  const publicSurfaces = inferPublicSurfaces(sources, packageJson);

  return {
    schemaVersion: ATLAS_SCHEMA_VERSION,
    generatedAt: (options.now ?? new Date()).toISOString(),
    generator: { name: "GroundAtlas", version },
    repository: {
      name: packageJson?.name ?? path.basename(cwd),
      root: cwd,
      git,
      packageManager: inferPackageManager(sourcePaths),
    },
    policy: {
      generatedDocsAreNotSsot: true,
      canonicalTruthLivesIn: [
        "source code",
        "schemas",
        "tests",
        "package manifests",
        "PROJECT.md",
        ".doctrine/project.json",
        "docs/adr/",
        "CI workflows",
      ],
      writeBoundary: `${options.outputDir}/ plus ${CONFIG_FILE_NAME} during init only`,
    },
    sources: sources.sort(compareSources),
    publicSurfaces,
    validationCommands,
    risks,
  };
}

const CONFIG_FILE_NAME = "groundatlas.config.json";

function inferPackageManager(sourcePaths: Set<string>): AtlasMap["repository"]["packageManager"] {
  if (sourcePaths.has("bun.lock")) return "bun";
  if (sourcePaths.has("pnpm-lock.yaml")) return "pnpm";
  if (sourcePaths.has("package-lock.json")) return "npm";
  if (sourcePaths.has("yarn.lock")) return "yarn";
  return "unknown";
}

function inferValidationCommands(packageJson: PackageJson | null): ValidationCommand[] {
  const scripts = packageJson?.scripts ?? {};
  const preferred = ["check", "test", "typecheck", "lint", "build", "format"];
  return preferred
    .filter((script) => scripts[script])
    .map((script) => ({
      command: `bun run ${script}`,
      source: "package.json",
      reason: `package.json defines the ${script} validation script.`,
    }));
}

function inferPublicSurfaces(
  sources: AtlasMap["sources"],
  packageJson: PackageJson | null,
): PublicSurface[] {
  const surfaces: PublicSurface[] = [];
  for (const source of sources) {
    if (source.path === "README.md")
      surfaces.push({ name: "README", type: "docs", path: source.path });
    if (source.path === "PROJECT.md")
      surfaces.push({ name: "Project manifest", type: "manifest", path: source.path });
    if (source.path === ".doctrine/project.json")
      surfaces.push({ name: "Machine project manifest", type: "manifest", path: source.path });
    if (source.kind === "ci-workflow")
      surfaces.push({ name: source.path, type: "workflow", path: source.path });
    if (source.kind === "schema")
      surfaces.push({ name: source.path, type: "schema", path: source.path });
  }
  if (packageJson?.bin) {
    surfaces.push({ name: "package binaries", type: "cli", path: "package.json" });
  }
  if (packageJson?.exports) {
    surfaces.push({ name: "package exports", type: "package", path: "package.json" });
  }
  return surfaces.sort((left, right) => left.path.localeCompare(right.path));
}

function inferRisks(sourcePaths: Set<string>, validationCommands: ValidationCommand[]): Risk[] {
  const risks: Risk[] = [];
  if (!sourcePaths.has("PROJECT.md")) {
    risks.push({
      severity: "error",
      code: "missing-project-md",
      message: "PROJECT.md is missing; repo-local project identity has no human entry point.",
    });
  }
  if (!sourcePaths.has(".doctrine/project.json")) {
    risks.push({
      severity: "error",
      code: "missing-project-manifest",
      message: ".doctrine/project.json is missing; repo-local boundary is not machine-readable.",
    });
  }
  if (!sourcePaths.has("AGENTS.md") && !sourcePaths.has("CLAUDE.md")) {
    risks.push({
      severity: "warning",
      code: "missing-agent-adapter",
      message: "No root AGENTS.md or CLAUDE.md adapter was found.",
    });
  }
  if (validationCommands.length === 0) {
    risks.push({
      severity: "warning",
      code: "missing-validation-commands",
      message: "No package validation commands were discovered.",
    });
  }
  if (
    ![...sourcePaths].some(
      (sourcePath) => sourcePath.startsWith("test/") || sourcePath.includes(".test."),
    )
  ) {
    risks.push({
      severity: "warning",
      code: "missing-tests",
      message: "No tests were discovered in the scanned source set.",
    });
  }
  return risks;
}

function compareSources(
  left: AtlasMap["sources"][number],
  right: AtlasMap["sources"][number],
): number {
  const kindCompare = left.kind.localeCompare(right.kind);
  return kindCompare === 0 ? left.path.localeCompare(right.path) : kindCompare;
}
