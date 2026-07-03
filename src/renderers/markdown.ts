import type { AtlasMap, FleetReport, ImpactEntry, Risk, SourceEntry } from "../domain/types.js";
import { GENERATED_BANNER } from "../domain/types.js";

export function renderGeneratedHeader(title: string): string {
  return `# ${title}\n\n> ${GENERATED_BANNER}\n> Canonical truth is fact-scoped and lives in linked source files, schemas, tests, specs, ADRs, manifests, and workflows.\n\n`;
}

export function renderReadme(map: AtlasMap): string {
  const risks =
    map.risks.length === 0
      ? "No material repository context risks detected."
      : renderRisks(map.risks);
  return `${renderGeneratedHeader(`${map.repository.name} context map`)}## Start here\n\n- Source map: [source-map.md](./source-map.md)\n- Change guide: [change-guide.md](./change-guide.md)\n- Machine atlas: [atlas.json](./atlas.json)\n\n## Repository identity\n\n- Name: ${map.repository.name}\n- Package manager: ${map.repository.packageManager}\n\nGit branch/head are intentionally omitted from generated Markdown because they are volatile checkout metadata, not project truth. Use \`atlas.json\` or \`git\` directly when a workflow needs exact checkout state.\n\n## Orientation route\n\n${renderOrientation(map)}\n\n## Truth model\n\n${renderTruthHomes(map)}\n\n## Canonical truth homes\n\n${map.policy.canonicalTruthLivesIn.map((home) => `- ${home}`).join("\n")}\n\n## Public surfaces\n\n${table(
    ["Type", "Name", "Path"],
    map.publicSurfaces.map((surface) => [surface.type, surface.name, code(surface.path)]),
  )}\n\n## Current risks\n\n${risks}\n`;
}

export function renderSourceMap(map: AtlasMap): string {
  const canonicalSources = map.sources.filter((source) => source.canonical);
  const supportingSources = map.sources.filter((source) => !source.canonical).slice(0, 80);
  return `${renderGeneratedHeader("Source map")}## Orientation route\n\n${renderOrientation(map)}\n\n## Canonical sources\n\n${renderSourceTable(canonicalSources)}\n\n## Supporting sources\n\n${renderSourceTable(supportingSources)}\n\n`;
}

export function renderChangeGuide(map: AtlasMap): string {
  const commands = map.validationCommands.length
    ? map.validationCommands
        .map((command) => `- \`${command.command}\` — ${command.reason}`)
        .join("\n")
    : "- No validation commands discovered. Add package scripts or neutral project manifest commands so GroundAtlas can route agents to the right checks.";
  return `${renderGeneratedHeader("Change guide")}## Write boundary\n\nGroundAtlas generated files live under \`${map.policy.writeBoundary}\`. Product source, ADRs, specs, schemas, manifests, and tests remain canonical.\n\n## Truth conflict rule\n\n${map.truth.conflictRule}\n\n## Validation commands\n\n${commands}\n\n## Change workflow\n\n1. Identify the owning canonical source in [source-map.md](./source-map.md).\n2. Change the canonical source, not the generated map.\n3. Run the narrowest relevant validation command above.\n4. Run \`ga update\` to refresh generated navigation.\n5. Run \`ga audit\` to verify the generated map still declares its non-SSOT boundary.\n\n## Agent handoff\n\nFuture agents should use this directory as a map, then inspect the linked source files before making durable decisions.\n`;
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

export function renderFleetReport(report: FleetReport): string {
  return [
    "# GroundAtlas fleet adoption report",
    "",
    `Generated: ${report.generatedAt}`,
    `Root: ${report.root}`,
    `Policy: generated atlas ${
      report.policy.generatedAtlasRequired ? "required" : "optional"
    }, strict ${report.policy.strict ? "on" : "off"}`,
    "",
    `Summary: ${report.summary.adopted} adopted, ${report.summary.warning} warning, ${report.summary.blocked} blocked, ${report.summary.total} total.`,
    "",
    table(
      ["Status", "Project", "Path", "Dogfood signals", "Issues"],
      report.projects.map((project) => [
        project.status,
        project.name,
        code(project.path),
        dogfoodSignals(project),
        issueSummary(project.issues),
      ]),
    ),
  ].join("\n");
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

export function renderOrientation(map: AtlasMap): string {
  return table(
    ["Order", "Read this", "Required", "Present", "SSOT role"],
    map.orientation.map((step) => [
      String(step.order),
      `${step.title} (${step.paths.map(code).join(", ")})`,
      step.required ? "yes" : "no",
      step.present ? "yes" : "no",
      step.ssotRole,
    ]),
  );
}

export function renderTruthHomes(map: AtlasMap): string {
  return table(
    ["Precedence", "Domain", "Owns", "Examples"],
    map.truth.homes.map((home) => [
      String(home.precedence),
      home.domain,
      home.owns,
      home.examples.map(code).join(", "),
    ]),
  );
}

function code(value: string): string {
  return `\`${value}\``;
}

function dogfoodSignals(project: FleetReport["projects"][number]): string {
  return [
    project.hasProjectFile ? "PROJECT.md" : "missing PROJECT.md",
    manifestSignal(project),
    project.hasAgentAdapter ? "agent adapter" : "missing agent adapter",
    project.hasValidationCommands ? "validation commands" : "missing validation commands",
    project.generatedAtlas.present
      ? `${project.outputDir}/atlas.json`
      : `missing ${project.outputDir}`,
    project.generatedAtlas.checked
      ? project.generatedAtlas.ok
        ? "atlas audit ok"
        : "atlas audit failed"
      : "atlas audit not checked",
  ].join("; ");
}

function manifestSignal(project: FleetReport["projects"][number]): string {
  if (!project.manifest.path) return "missing machine manifest";
  const adapter = project.manifest.adapter ? " adapter" : "";
  const status = project.manifest.valid ? "valid" : "invalid";
  const adoption = project.manifest.adoptionStatus
    ? `, adoption ${project.manifest.adoptionStatus}`
    : "";
  const selected = `${status} ${project.manifest.kind}${adapter}: ${project.manifest.path}${adoption}`;
  const separateAdapters = project.manifestAdapters.filter(
    (manifest) => manifest.path !== project.manifest.path,
  );
  if (separateAdapters.length === 0) return selected;
  const adapters = separateAdapters
    .map((manifest) => {
      const adapterStatus = manifest.valid ? "valid" : "invalid";
      return `${adapterStatus} ${manifest.kind} adapter: ${manifest.path}`;
    })
    .join(", ");
  return `${selected}; adapters: ${adapters}`;
}

function issueSummary(issues: Risk[]): string {
  if (issues.length === 0) return "none";
  return issues.map((issue) => `${issue.severity}:${issue.code}`).join(", ");
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
