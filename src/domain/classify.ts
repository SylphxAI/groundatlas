import path from "node:path";
import type { SourceEntry, SourceKind } from "./types.js";
import { AGENT_ADAPTER_PATHS, MACHINE_PROJECT_MANIFEST_PATHS } from "./types.js";

export function classifySource(
  relativePath: string,
  sizeBytes: number,
  contentSha256: string,
): SourceEntry {
  const normalized = relativePath.toLowerCase();
  const base = path.posix.basename(normalized);
  const kind = classifyKind(normalized, base);
  return {
    path: relativePath,
    kind,
    reason: reasonForKind(kind, relativePath),
    canonical: isCanonical(kind, normalized),
    sizeBytes,
    contentSha256,
  };
}

function classifyKind(normalized: string, base: string): SourceKind {
  if (normalized === "project.md" || isMachineProjectManifestPath(normalized)) {
    return "project-manifest";
  }
  if (isAgentAdapterPath(normalized, base)) return "agent-adapter";
  if (normalized.startsWith("docs/adr/") || base.startsWith("adr-")) return "adr";
  if (normalized.startsWith("docs/specs/") || normalized.startsWith("specs/")) return "spec";
  if (
    ["design.md", "design.mdx", "architecture.md", "architecture.mdx"].includes(base) ||
    normalized.startsWith("docs/design/") ||
    normalized.startsWith("design/")
  ) {
    return "design-doc";
  }
  if (normalized.startsWith("runbooks/") || normalized.startsWith("docs/runbooks/")) {
    return "runbook";
  }
  if (normalized.includes("schema") || normalized.endsWith(".schema.json")) return "schema";
  if (
    normalized.startsWith(".github/workflows/") &&
    (normalized.endsWith(".yml") || normalized.endsWith(".yaml"))
  ) {
    return "ci-workflow";
  }
  if (
    ["package.json", "bun.lock", "pnpm-lock.yaml", "package-lock.json", "yarn.lock"].includes(base)
  ) {
    return "package-manifest";
  }
  if (
    [
      "tsconfig.json",
      "biome.json",
      "eslint.config.js",
      "eslint.config.mjs",
      "vite.config.js",
    ].includes(base) ||
    normalized.startsWith(".github/")
  ) {
    return "build-config";
  }
  if (base === "license" || base.startsWith("license.")) return "license";
  if (base === "security.md") return "security-policy";
  if (isTestPath(normalized, base)) return "test";
  if (
    normalized.startsWith("docs/") ||
    ["readme.md", "contributing.md", "governance.md"].includes(base)
  ) {
    return "documentation";
  }
  if (normalized.startsWith("src/") || normalized.startsWith("lib/")) return "source";
  if (normalized.startsWith(".groundatlas/")) return "generated-map";
  return "unknown";
}

function isMachineProjectManifestPath(normalized: string): boolean {
  return MACHINE_PROJECT_MANIFEST_PATHS.some((candidate) => candidate.toLowerCase() === normalized);
}

function isAgentAdapterPath(normalized: string, base: string): boolean {
  return (
    base === "agents.md" ||
    AGENT_ADAPTER_PATHS.some((candidate) => candidate.toLowerCase() === normalized)
  );
}

function isTestPath(normalized: string, base: string): boolean {
  return (
    normalized.startsWith("test/") ||
    normalized.startsWith("tests/") ||
    normalized.includes("/test/") ||
    normalized.includes("/tests/") ||
    base.includes(".test.") ||
    base.includes(".spec.")
  );
}

function isCanonical(kind: SourceKind, normalized: string): boolean {
  return (
    kind === "project-manifest" ||
    kind === "agent-adapter" ||
    kind === "adr" ||
    kind === "design-doc" ||
    kind === "spec" ||
    kind === "schema" ||
    kind === "package-manifest" ||
    kind === "ci-workflow" ||
    kind === "runbook" ||
    kind === "security-policy" ||
    kind === "source" ||
    kind === "test" ||
    kind === "license" ||
    normalized === "readme.md"
  );
}

function reasonForKind(kind: SourceKind, relativePath: string): string {
  switch (kind) {
    case "project-manifest":
      return "Defines repository identity, lifecycle, boundary, or project-local truth.";
    case "agent-adapter":
      return "Bootstraps agents into repo-local context; AGENTS.md is preferred and tool-specific adapters are optional.";
    case "adr":
      return "Records durable architecture or product decisions.";
    case "design-doc":
      return "Explains product or system design intent; durable decisions should graduate into ADRs, specs, schemas, or tests.";
    case "spec":
      return "Defines product, behavior, adoption, or operating contracts that implementation must satisfy.";
    case "schema":
      return "Defines machine-checkable contracts.";
    case "ci-workflow":
      return "Defines validation and automation gates.";
    case "package-manifest":
      return "Defines package metadata, binaries, scripts, and dependency surface.";
    case "build-config":
      return "Configures build, lint, test, or tooling behavior.";
    case "license":
      return "Defines open-source distribution terms.";
    case "security-policy":
      return "Defines vulnerability reporting and security contact process.";
    case "test":
      return "Proves expected behavior or regression coverage.";
    case "documentation":
      return "Explains usage, contribution, or operational context.";
    case "runbook":
      return "Explains repeatable operational procedure.";
    case "source":
      return "Implements product behavior.";
    case "generated-map":
      return "Generated navigation aid; not canonical truth.";
    case "unknown":
      return `Unclassified repository file: ${relativePath}.`;
  }
}
