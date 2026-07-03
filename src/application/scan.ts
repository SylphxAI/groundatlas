import path from "node:path";
import packageJson from "../../package.json" with { type: "json" };

import { classifySource } from "../domain/classify.js";
import {
  ATLAS_SCHEMA_VERSION,
  type AtlasMap,
  type OrientationStep,
  type PublicSurface,
  type Risk,
  type ScanOptions,
  type TruthHome,
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

  const sources = files.map((file) =>
    classifySource(file.path, file.sizeBytes, file.contentSha256),
  );
  const sourcePaths = new Set(sources.map((source) => source.path));
  const validationCommands = inferValidationCommands(packageJson);
  const risks = inferRisks(sourcePaths, validationCommands);
  const publicSurfaces = inferPublicSurfaces(sources, packageJson);
  const truthHomes = truthHomeModel();

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
        "specs/design docs",
        "package manifests",
        "PROJECT.md",
        ".doctrine/project.json",
        "docs/adr/",
        "CI workflows",
      ],
      writeBoundary: `${options.outputDir}/ plus ${CONFIG_FILE_NAME} during init only`,
    },
    truth: {
      model: "fact-scoped-ssot",
      conflictRule:
        "Resolve each fact at its owning truth home; if sources disagree, change the owning source and regenerate GroundAtlas rather than editing generated maps.",
      generatedArtifactsAre: "navigation-only",
      homes: truthHomes,
    },
    orientation: inferOrientation(sourcePaths),
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
    if (source.kind === "spec" || source.kind === "design-doc" || source.kind === "runbook") {
      surfaces.push({ name: source.path, type: "docs", path: source.path });
    }
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
  if (!sourcePaths.has("README.md")) {
    risks.push({
      severity: "warning",
      code: "missing-readme",
      message: "README.md is missing; public human entry point is not explicit.",
    });
  }
  if (!hasAny(sourcePaths, (sourcePath) => sourcePath.startsWith("docs/adr/"))) {
    risks.push({
      severity: "warning",
      code: "missing-adr-records",
      message:
        "No docs/adr/ records were discovered; durable decisions may be buried in prose or chat.",
    });
  }
  if (
    !hasAny(
      sourcePaths,
      (sourcePath) =>
        sourcePath.startsWith("docs/specs/") ||
        sourcePath.toLowerCase() === "design.md" ||
        sourcePath.toLowerCase() === "design.mdx",
    )
  ) {
    risks.push({
      severity: "warning",
      code: "missing-spec-or-design",
      message: "No docs/specs/ or DESIGN.md was discovered; product intent may not be reviewable.",
    });
  }
  if (!hasAny(sourcePaths, (sourcePath) => sourcePath.startsWith(".github/workflows/"))) {
    risks.push({
      severity: "warning",
      code: "missing-ci-workflows",
      message: "No GitHub workflow was discovered; validation may rely on local discipline.",
    });
  }
  if (!sourcePaths.has("SECURITY.md")) {
    risks.push({
      severity: "warning",
      code: "missing-security-policy",
      message:
        "SECURITY.md is missing; vulnerability reporting and security expectations are unclear.",
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
    !hasAny(
      sourcePaths,
      (sourcePath) =>
        sourcePath.startsWith("test/") ||
        sourcePath.startsWith("tests/") ||
        sourcePath.includes("/test/") ||
        sourcePath.includes("/tests/") ||
        sourcePath.includes(".test.") ||
        sourcePath.includes(".spec."),
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

function hasAny(sourcePaths: Set<string>, predicate: (sourcePath: string) => boolean): boolean {
  return [...sourcePaths].some(predicate);
}

function truthHomeModel(): TruthHome[] {
  return [
    {
      domain: "Project identity and boundaries",
      owns: "What the project is, lifecycle, owner boundary, public surfaces, adoption state, and delivery proof.",
      examples: ["PROJECT.md", ".doctrine/project.json"],
      precedence: 10,
      requiredForSylphx: true,
    },
    {
      domain: "Durable decisions",
      owns: "Architecture, product, data, security, operations, or commercial decisions that must survive beyond one edit.",
      examples: ["docs/adr/"],
      precedence: 20,
      requiredForSylphx: true,
    },
    {
      domain: "Product intent and operating contracts",
      owns: "Requirements, adoption rules, operating models, design intent, and acceptance criteria.",
      examples: ["docs/specs/", "DESIGN.md", "design.md"],
      precedence: 30,
      requiredForSylphx: true,
    },
    {
      domain: "Machine-checkable contracts",
      owns: "Schemas, type contracts, migrations, package exports, command surfaces, and dependency boundaries.",
      examples: ["src/domain/types.ts", "*.schema.json", "package.json"],
      precedence: 40,
      requiredForSylphx: true,
    },
    {
      domain: "Implemented behavior",
      owns: "What the product actually does at runtime.",
      examples: ["src/", "lib/"],
      precedence: 50,
      requiredForSylphx: true,
    },
    {
      domain: "Behavior proof",
      owns: "Expected behavior, regressions, evals, validation commands, and release gates.",
      examples: ["test/", "tests/", "package.json scripts", ".github/workflows/"],
      precedence: 60,
      requiredForSylphx: true,
    },
    {
      domain: "Operations, security, and support",
      owns: "Repeatable procedures, vulnerability reporting, incident handling, and customer support expectations.",
      examples: ["docs/runbooks/", "SECURITY.md", "CHANGELOG.md"],
      precedence: 70,
      requiredForSylphx: true,
    },
  ];
}

function inferOrientation(sourcePaths: Set<string>): OrientationStep[] {
  const hasProject = sourcePaths.has("PROJECT.md");
  const hasMachineManifest = sourcePaths.has(".doctrine/project.json");
  const hasAgentAdapter = sourcePaths.has("AGENTS.md") || sourcePaths.has("CLAUDE.md");
  const hasSpecs = hasAny(sourcePaths, (sourcePath) => sourcePath.startsWith("docs/specs/"));
  const hasDesign = sourcePaths.has("DESIGN.md") || sourcePaths.has("design.md");
  const hasAdr = hasAny(sourcePaths, (sourcePath) => sourcePath.startsWith("docs/adr/"));
  const hasSchema = hasAny(
    sourcePaths,
    (sourcePath) => sourcePath.includes("schema") || sourcePath.endsWith(".schema.json"),
  );
  const hasSource = hasAny(
    sourcePaths,
    (sourcePath) => sourcePath.startsWith("src/") || sourcePath.startsWith("lib/"),
  );
  const hasTests = hasAny(
    sourcePaths,
    (sourcePath) =>
      sourcePath.startsWith("test/") ||
      sourcePath.startsWith("tests/") ||
      sourcePath.includes("/test/") ||
      sourcePath.includes("/tests/") ||
      sourcePath.includes(".test.") ||
      sourcePath.includes(".spec."),
  );
  const hasWorkflows = hasAny(sourcePaths, (sourcePath) =>
    sourcePath.startsWith(".github/workflows/"),
  );
  const hasRunbooks = hasAny(
    sourcePaths,
    (sourcePath) => sourcePath.startsWith("docs/runbooks/") || sourcePath.startsWith("runbooks/"),
  );

  return [
    {
      order: 1,
      title: "Agent and doctrine adapter",
      paths: ["AGENTS.md", "CLAUDE.md"],
      required: true,
      present: hasAgentAdapter,
      reason: "Start with local agent rules so automation follows the repository boundary.",
      ssotRole:
        "Runtime adapter; it routes to project and doctrine truth rather than replacing it.",
    },
    {
      order: 2,
      title: "Project identity and machine manifest",
      paths: ["PROJECT.md", ".doctrine/project.json"],
      required: true,
      present: hasProject && hasMachineManifest,
      reason:
        "Find the project goal, lifecycle, owner boundary, public surfaces, and adoption state.",
      ssotRole: "Canonical truth for project identity and boundaries.",
    },
    {
      order: 3,
      title: "Public start-here documentation",
      paths: ["README.md"],
      required: true,
      present: sourcePaths.has("README.md"),
      reason: "Read the product promise, install path, and user-facing contract.",
      ssotRole:
        "Canonical public entry point; lower authority than schemas, tests, ADRs, and source.",
    },
    {
      order: 4,
      title: "Specs and design intent",
      paths: ["docs/specs/", "DESIGN.md", "design.md"],
      required: true,
      present: hasSpecs || hasDesign,
      reason:
        "Understand intended behavior, adoption rules, and design constraints before editing.",
      ssotRole:
        "Canonical for intended product/operating contracts until implemented facts disagree.",
    },
    {
      order: 5,
      title: "Architecture and decision records",
      paths: ["docs/adr/"],
      required: true,
      present: hasAdr,
      reason: "Find durable choices and trade-offs before inventing a new pattern.",
      ssotRole: "Canonical for durable decisions; newer ADRs supersede older conflicting prose.",
    },
    {
      order: 6,
      title: "Machine contracts and build surfaces",
      paths: ["package.json", "schemas", "migrations", "src/domain/types.ts"],
      required: true,
      present: sourcePaths.has("package.json") || hasSchema,
      reason: "Identify commands, exports, schemas, and machine-readable contracts.",
      ssotRole: "Canonical for package, schema, API, and type contracts.",
    },
    {
      order: 7,
      title: "Implementation and behavior proof",
      paths: ["src/", "lib/", "test/", "tests/"],
      required: true,
      present: hasSource && hasTests,
      reason: "Verify how the product actually behaves and what regressions are protected.",
      ssotRole: "Canonical for implemented behavior and expected behavior.",
    },
    {
      order: 8,
      title: "CI, release, security, and operations",
      paths: [".github/workflows/", "docs/runbooks/", "SECURITY.md", "CHANGELOG.md"],
      required: true,
      present: hasWorkflows && (hasRunbooks || sourcePaths.has("SECURITY.md")),
      reason:
        "Prove the delivery path, release gates, operational procedures, and support boundary.",
      ssotRole: "Canonical for validation automation, release operations, and support procedures.",
    },
  ];
}

function compareSources(
  left: AtlasMap["sources"][number],
  right: AtlasMap["sources"][number],
): number {
  const kindCompare = left.kind.localeCompare(right.kind);
  return kindCompare === 0 ? left.path.localeCompare(right.path) : kindCompare;
}
