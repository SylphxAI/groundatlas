import type { AtlasMap, ImpactEntry, Risk, SourceEntry } from "../domain/types.js";
import { GENERATED_BANNER } from "../domain/types.js";

export function renderGeneratedHeader(title: string): string {
  return `# ${title}\n\n> ${GENERATED_BANNER}\n> Canonical truth lives in linked source files, schemas, tests, ADRs, manifests, and workflows.\n\n`;
}

export function renderReadme(map: AtlasMap): string {
  const risks =
    map.risks.length === 0
      ? "No material repository context risks detected."
      : renderRisks(map.risks);
  return `${renderGeneratedHeader(`${map.repository.name} context map`)}## Start here\n\n- Source map: [source-map.md](./source-map.md)\n- Change guide: [change-guide.md](./change-guide.md)\n- Machine atlas: [atlas.json](./atlas.json)\n\n## Repository identity\n\n- Name: ${map.repository.name}\n- Git branch: ${map.repository.git.branch ?? "unknown"}\n- Git head: ${map.repository.git.head ?? "unknown"}\n- Package manager: ${map.repository.packageManager}\n\n## Canonical truth homes\n\n${map.policy.canonicalTruthLivesIn.map((home) => `- ${home}`).join("\n")}\n\n## Public surfaces\n\n${table(
    ["Type", "Name", "Path"],
    map.publicSurfaces.map((surface) => [surface.type, surface.name, code(surface.path)]),
  )}\n\n## Current risks\n\n${risks}\n`;
}

export function renderSourceMap(map: AtlasMap): string {
  const canonicalSources = map.sources.filter((source) => source.canonical);
  const supportingSources = map.sources.filter((source) => !source.canonical).slice(0, 80);
  return `${renderGeneratedHeader("Source map")}## Canonical sources\n\n${renderSourceTable(canonicalSources)}\n\n## Supporting sources\n\n${renderSourceTable(supportingSources)}\n\n`;
}

export function renderChangeGuide(map: AtlasMap): string {
  const commands = map.validationCommands.length
    ? map.validationCommands
        .map((command) => `- \`${command.command}\` — ${command.reason}`)
        .join("\n")
    : "- No validation commands discovered. Add package scripts so GroundAtlas can route agents to the right checks.";
  return `${renderGeneratedHeader("Change guide")}## Write boundary\n\nGroundAtlas generated files live under \`${map.policy.writeBoundary}\`. Product source, ADRs, schemas, manifests, and tests remain canonical.\n\n## Validation commands\n\n${commands}\n\n## Change workflow\n\n1. Identify the owning canonical source in [source-map.md](./source-map.md).\n2. Change the canonical source, not the generated map.\n3. Run the narrowest relevant validation command above.\n4. Run \`ga update\` to refresh generated navigation.\n5. Run \`ga audit\` to verify the generated map still declares its non-SSOT boundary.\n\n## Agent handoff\n\nFuture agents should use this directory as a map, then inspect the linked source files before making durable decisions.\n`;
}

export function renderImpact(entries: ImpactEntry[]): string {
  if (entries.length === 0) {
    return "No changed files were found for the selected git range.";
  }
  return table(
    ["Status", "Changed path", "Matched atlas sources"],
    entries.map((entry) => [
      entry.status,
      code(entry.path),
      entry.matchedSources.map((source) => `${source.kind}:${source.path}`).join(", ") ||
        "No direct atlas match",
    ]),
  );
}

export function renderRisks(risks: Risk[]): string {
  return risks.map((risk) => `- **${risk.severity}** \`${risk.code}\`: ${risk.message}`).join("\n");
}

export function renderSourceTable(sources: SourceEntry[]): string {
  if (sources.length === 0) {
    return "No sources discovered.";
  }
  return table(
    ["Kind", "Path", "Why it matters"],
    sources.map((source) => [source.kind, code(source.path), source.reason]),
  );
}

function code(value: string): string {
  return `\`${value}\``;
}

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return "No entries.";
  }
  const header = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`).join("\n");
  return `${header}\n${separator}\n${body}`;
}

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
