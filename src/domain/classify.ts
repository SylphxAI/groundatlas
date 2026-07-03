import path from "node:path";
import type { SourceEntry, SourceKind } from "./types.ts";

export function classifySource(relativePath: string, sizeBytes: number): SourceEntry {
  const normalized = relativePath.toLowerCase();
  const base = path.posix.basename(normalized);
  const kind = classifyKind(normalized, base);
  return {
    path: relativePath,
    kind,
    reason: reasonForKind(kind, relativePath),
    canonical: isCanonical(kind, normalized),
    sizeBytes,
  };
}

function classifyKind(normalized: string, base: string): SourceKind {
  if (normalized === "project.md" || normalized === ".doctrine/project.json")
    return "project-manifest";
  if (base === "agents.md" || base === "claude.md") return "agent-adapter";
  if (normalized.startsWith("docs/adr/") || base.startsWith("adr-")) return "adr";
  if (normalized.includes("schema") || normalized.endsWith(".schema.json")) return "schema";
  if (normalized.startsWith(".github/workflows/") && normalized.endsWith(".yml"))
    return "ci-workflow";
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
      "vite.config.ts",
    ].includes(base) ||
    normalized.startsWith(".github/")
  ) {
    return "build-config";
  }
  if (base === "license" || base.startsWith("license.")) return "license";
  if (base === "security.md") return "security-policy";
  if (normalized.includes("test") || normalized.includes("spec")) return "test";
  if (
    normalized.startsWith("docs/") ||
    ["readme.md", "contributing.md", "governance.md"].includes(base)
  ) {
    return "documentation";
  }
  if (normalized.startsWith("runbooks/") || normalized.includes("runbook")) return "runbook";
  if (normalized.startsWith("src/") || normalized.startsWith("lib/")) return "source";
  if (normalized.startsWith(".groundatlas/")) return "generated-map";
  return "unknown";
}

function isCanonical(kind: SourceKind, normalized: string): boolean {
  return (
    kind === "project-manifest" ||
    kind === "adr" ||
    kind === "schema" ||
    kind === "package-manifest" ||
    kind === "ci-workflow" ||
    kind === "source" ||
    normalized === "readme.md"
  );
}

function reasonForKind(kind: SourceKind, relativePath: string): string {
  switch (kind) {
    case "project-manifest":
      return "Defines repository identity, lifecycle, boundary, or project-local truth.";
    case "agent-adapter":
      return "Bootstraps agents into repo-local context and central doctrine.";
    case "adr":
      return "Records durable architecture or product decisions.";
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
