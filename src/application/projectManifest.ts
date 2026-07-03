import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  MachineManifestInspection,
  MachineManifestKind,
  MachineManifestReport,
  Risk,
  ValidationCommand,
} from "../domain/types.js";

const NEUTRAL_MANIFEST_PATHS: Record<string, MachineManifestKind> = {
  "project.manifest.json": "project.manifest",
  "groundatlas.project.json": "groundatlas.project",
  ".project/manifest.json": "project-folder-manifest",
};

const DOCTRINE_ADAPTER_PATH = ".doctrine/project.json";
const NEUTRAL_MANIFEST_PRIORITY = [
  "project.manifest.json",
  "groundatlas.project.json",
  ".project/manifest.json",
] as const;
const MANIFEST_PRIORITY = [...NEUTRAL_MANIFEST_PRIORITY, DOCTRINE_ADAPTER_PATH] as const;

const TOP_LEVEL_KEYS = new Set([
  "$schema",
  "schemaVersion",
  "project",
  "truth",
  "surfaces",
  "commands",
  "adoption",
]);
const PROJECT_KEYS = new Set([
  "id",
  "name",
  "summary",
  "lifecycle",
  "visibility",
  "repository",
  "homepage",
  "tags",
]);
const TRUTH_KEYS = new Set([
  "humanProjectFile",
  "agentAdapter",
  "specs",
  "adrs",
  "source",
  "tests",
  "runbooks",
]);
const SURFACE_TYPES = new Set([
  "cli",
  "api",
  "package",
  "docs",
  "schema",
  "github-action",
  "workflow",
  "service",
  "website",
  "other",
]);
const LIFECYCLES = new Set([
  "idea",
  "experimental",
  "active",
  "production",
  "maintenance",
  "deprecated",
  "archived",
]);
const VISIBILITIES = new Set(["open-source", "public", "private", "internal"]);
const ADOPTION_STATUSES = new Set([
  "planned",
  "adopted",
  "warning",
  "blocked",
  "exception",
  "unknown",
]);

export async function inspectMachineProjectManifest(
  cwd: string,
  sourcePaths: Set<string>,
): Promise<MachineManifestReport> {
  return (await inspectMachineProjectManifests(cwd, sourcePaths)).selected;
}

export async function inspectMachineProjectManifests(
  cwd: string,
  sourcePaths: Set<string>,
): Promise<MachineManifestInspection> {
  const manifestPaths = selectManifestPaths(sourcePaths);
  if (manifestPaths.length === 0) {
    return {
      selected: emptyManifestReport(),
      discovered: [],
      adapters: [],
    };
  }

  const discovered = await Promise.all(
    manifestPaths.map((manifestPath) => validateManifestPath(cwd, manifestPath)),
  );
  const selected = discovered[0] ?? emptyManifestReport();

  return {
    selected,
    discovered,
    adapters: discovered.filter((manifest) => manifest.adapter),
  };
}

export async function validateMachineProjectManifestFile(
  filePath: string,
  reportPath = filePath,
): Promise<MachineManifestReport> {
  return validateManifestFile(path.resolve(filePath), normalizeManifestPath(reportPath));
}

export const validateProjectManifestFile = validateMachineProjectManifestFile;

export async function readProjectManifestValidationCommands(
  cwd: string,
  sourcePaths: Set<string>,
): Promise<ValidationCommand[]> {
  const selectedNeutralManifestPath = NEUTRAL_MANIFEST_PRIORITY.find((manifestPath) =>
    sourcePaths.has(manifestPath),
  );
  if (!selectedNeutralManifestPath) return [];

  const absolutePath = path.join(cwd, selectedNeutralManifestPath);
  const report = await validateManifestFile(absolutePath, selectedNeutralManifestPath);
  if (!report.valid) return [];

  const parsed = await readJsonObject(absolutePath);
  if (!parsed.ok) return [];
  return readNeutralManifestCommands(parsed.value.commands, selectedNeutralManifestPath);
}

async function validateManifestPath(
  cwd: string,
  manifestPath: string,
): Promise<MachineManifestReport> {
  return validateManifestFile(path.join(cwd, manifestPath), manifestPath);
}

async function validateManifestFile(
  filePath: string,
  manifestPath: string,
): Promise<MachineManifestReport> {
  const normalizedManifestPath = normalizeManifestPath(manifestPath);
  const kind = manifestKind(normalizedManifestPath);
  const parsed = await readJsonObject(filePath);
  if (!parsed.ok) {
    const code =
      parsed.errorCode === "ENOENT"
        ? "project-manifest-unreadable"
        : "invalid-project-manifest-json";
    return {
      path: normalizedManifestPath,
      kind,
      adapter: isAdapter(normalizedManifestPath),
      valid: false,
      issues: [
        {
          severity: "error",
          code,
          source: normalizedManifestPath,
          message:
            code === "project-manifest-unreadable"
              ? `${normalizedManifestPath} could not be read: ${parsed.error}`
              : `${normalizedManifestPath} is not valid JSON: ${parsed.error}`,
        },
      ],
    };
  }

  return isAdapter(normalizedManifestPath)
    ? validateDoctrineAdapter(parsed.value, normalizedManifestPath)
    : validateNeutralManifest(parsed.value, normalizedManifestPath);
}

function emptyManifestReport(): MachineManifestReport {
  return {
    path: null,
    kind: null,
    adapter: false,
    valid: false,
    issues: [],
  };
}

function selectManifestPaths(sourcePaths: Set<string>): string[] {
  return MANIFEST_PRIORITY.filter((manifestPath) => sourcePaths.has(manifestPath));
}

function manifestKind(manifestPath: string): MachineManifestKind {
  const canonicalPath = canonicalManifestPath(manifestPath);
  if (canonicalPath === DOCTRINE_ADAPTER_PATH) return "doctrine-adapter";
  return NEUTRAL_MANIFEST_PATHS[canonicalPath] ?? "project.manifest";
}

function isAdapter(manifestPath: string): boolean {
  return canonicalManifestPath(manifestPath) === DOCTRINE_ADAPTER_PATH;
}

function canonicalManifestPath(manifestPath: string): string {
  const normalized = normalizeManifestPath(manifestPath);
  for (const candidate of MANIFEST_PRIORITY) {
    if (normalized === candidate || normalized.endsWith(`/${candidate}`)) return candidate;
  }
  return normalized;
}

function normalizeManifestPath(value: string): string {
  return value.split(path.sep).join("/");
}

async function readJsonObject(
  filePath: string,
): Promise<
  { ok: true; value: Record<string, unknown> } | { ok: false; error: string; errorCode?: string }
> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return { ok: false, error: "top-level value must be an object" };
    }
    return { ok: true, value: parsed };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      errorCode: nodeError.code,
    };
  }
}

function validateNeutralManifest(
  manifest: Record<string, unknown>,
  manifestPath: string,
): MachineManifestReport {
  const issues: Risk[] = [];
  const project = readRecord(manifest.project);
  const adoption = readRecord(manifest.adoption);

  assertKeys(manifest, TOP_LEVEL_KEYS, manifestPath, issues);
  if (manifest.$schema !== undefined) {
    assertString(manifest.$schema, manifestPath, issues, "$schema must be a string.");
  }
  assert(manifest.schemaVersion === 1, manifestPath, issues, "schemaVersion must be 1.");
  assert(project !== null, manifestPath, issues, "project object is required.");

  if (project) {
    assertKeys(project, PROJECT_KEYS, manifestPath, issues, "project");
    assertString(project.id, manifestPath, issues, "project.id is required.");
    if (typeof project.id === "string" && !/^[a-z0-9][a-z0-9._-]*$/u.test(project.id)) {
      issues.push(invalidManifest(manifestPath, "project.id must match ^[a-z0-9][a-z0-9._-]*$."));
    }
    assertString(project.name, manifestPath, issues, "project.name is required.");
    assertString(project.summary, manifestPath, issues, "project.summary is required.");
    assertEnum(project.lifecycle, LIFECYCLES, manifestPath, issues, "project.lifecycle");
    if (project.visibility !== undefined) {
      assertEnum(project.visibility, VISIBILITIES, manifestPath, issues, "project.visibility");
    }
    if (project.repository !== undefined) {
      assertUri(project.repository, manifestPath, issues, "project.repository");
    }
    if (project.homepage !== undefined) {
      assertUri(project.homepage, manifestPath, issues, "project.homepage");
    }
    if (project.tags !== undefined) {
      assertStringArray(project.tags, manifestPath, issues, "project.tags");
      if (Array.isArray(project.tags) && new Set(project.tags).size !== project.tags.length) {
        issues.push(invalidManifest(manifestPath, "project.tags must be unique."));
      }
    }
  }

  validateTruth(manifest.truth, manifestPath, issues);
  validateSurfaces(manifest.surfaces, manifestPath, issues);
  validateCommands(manifest.commands, manifestPath, issues);
  validateAdoption(adoption, manifestPath, issues);

  const adoptionStatus = readString(adoption?.status);
  if (adoptionStatus === "blocked") {
    issues.push({
      severity: "error",
      code: "project-manifest-adoption-blocked",
      source: manifestPath,
      message: `${manifestPath} declares adoption.status=blocked.`,
    });
  } else if (adoptionStatus === "warning" || adoptionStatus === "exception") {
    issues.push({
      severity: "warning",
      code: `project-manifest-adoption-${adoptionStatus}`,
      source: manifestPath,
      message: `${manifestPath} declares adoption.status=${adoptionStatus}.`,
    });
  }

  return {
    path: manifestPath,
    kind: manifestKind(manifestPath),
    adapter: false,
    valid: !issues.some((issue) => issue.severity === "error"),
    projectId: readString(project?.id),
    projectName: readString(project?.name),
    lifecycle: readString(project?.lifecycle),
    adoptionStatus,
    issues,
  };
}

function validateDoctrineAdapter(
  manifest: Record<string, unknown>,
  manifestPath: string,
): MachineManifestReport {
  const issues: Risk[] = [];
  const project = readRecord(manifest.project);
  const adoption = readRecord(manifest.adoption);

  assert(manifest.schemaVersion === 1, manifestPath, issues, "schemaVersion must be 1.");
  assert(project !== null, manifestPath, issues, "project object is required.");
  if (project) {
    assertString(project.repo, manifestPath, issues, "project.repo is required.");
    assertString(project.name, manifestPath, issues, "project.name is required.");
    assertString(project.lifecycle, manifestPath, issues, "project.lifecycle is required.");
  }

  return {
    path: manifestPath,
    kind: "doctrine-adapter",
    adapter: true,
    valid: !issues.some((issue) => issue.severity === "error"),
    projectId: readString(project?.repo),
    projectName: readString(project?.name),
    lifecycle: readString(project?.lifecycle),
    adoptionStatus: readString(adoption?.status),
    issues,
  };
}

function validateTruth(value: unknown, manifestPath: string, issues: Risk[]): void {
  if (value === undefined) return;
  const truth = readRecord(value);
  if (!truth) {
    issues.push(invalidManifest(manifestPath, "truth must be an object."));
    return;
  }
  assertKeys(truth, TRUTH_KEYS, manifestPath, issues, "truth");
  for (const key of ["specs", "adrs", "source", "tests", "runbooks"]) {
    if (truth[key] !== undefined)
      assertStringArray(truth[key], manifestPath, issues, `truth.${key}`);
  }
  for (const key of ["humanProjectFile", "agentAdapter"]) {
    if (truth[key] !== undefined) assertString(truth[key], manifestPath, issues, `truth.${key}`);
  }
}

function validateSurfaces(value: unknown, manifestPath: string, issues: Risk[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    issues.push(invalidManifest(manifestPath, "surfaces must be an array."));
    return;
  }
  for (const [index, surfaceValue] of value.entries()) {
    const surface = readRecord(surfaceValue);
    if (!surface) {
      issues.push(invalidManifest(manifestPath, `surfaces[${index}] must be an object.`));
      continue;
    }
    assertKeys(
      surface,
      new Set(["type", "name", "path", "description"]),
      manifestPath,
      issues,
      `surfaces[${index}]`,
    );
    assertEnum(surface.type, SURFACE_TYPES, manifestPath, issues, `surfaces[${index}].type`);
    assertString(surface.name, manifestPath, issues, `surfaces[${index}].name is required.`);
    assertString(surface.path, manifestPath, issues, `surfaces[${index}].path is required.`);
    if (surface.description !== undefined) {
      assertString(surface.description, manifestPath, issues, `surfaces[${index}].description`);
    }
  }
}

function validateCommands(value: unknown, manifestPath: string, issues: Risk[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    issues.push(invalidManifest(manifestPath, "commands must be an array."));
    return;
  }
  for (const [index, commandValue] of value.entries()) {
    const command = readRecord(commandValue);
    if (!command) {
      issues.push(invalidManifest(manifestPath, `commands[${index}] must be an object.`));
      continue;
    }
    assertKeys(
      command,
      new Set(["name", "command", "purpose"]),
      manifestPath,
      issues,
      `commands[${index}]`,
    );
    assertString(command.name, manifestPath, issues, `commands[${index}].name is required.`);
    assertString(command.command, manifestPath, issues, `commands[${index}].command is required.`);
    assertString(command.purpose, manifestPath, issues, `commands[${index}].purpose is required.`);
  }
}

function readNeutralManifestCommands(value: unknown, manifestPath: string): ValidationCommand[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((commandValue) => {
    const command = readRecord(commandValue);
    const commandText = readString(command?.command);
    const name = readString(command?.name);
    const purpose = readString(command?.purpose);
    if (!commandText || !name || !purpose) return [];
    return [
      {
        command: commandText,
        source: manifestPath,
        reason: `project manifest declares the ${name} validation command: ${purpose}`,
      },
    ];
  });
}

function validateAdoption(
  adoption: Record<string, unknown> | null,
  manifestPath: string,
  issues: Risk[],
): void {
  if (!adoption) return;
  assertKeys(
    adoption,
    new Set(["status", "notes", "exceptions"]),
    manifestPath,
    issues,
    "adoption",
  );
  assertEnum(adoption.status, ADOPTION_STATUSES, manifestPath, issues, "adoption.status");
  if (adoption.notes !== undefined) {
    assertString(adoption.notes, manifestPath, issues, "adoption.notes");
  }
  if (adoption.exceptions === undefined) return;
  if (!Array.isArray(adoption.exceptions)) {
    issues.push(invalidManifest(manifestPath, "adoption.exceptions must be an array."));
    return;
  }
  for (const [index, exceptionValue] of adoption.exceptions.entries()) {
    const exception = readRecord(exceptionValue);
    if (!exception) {
      issues.push(
        invalidManifest(manifestPath, `adoption.exceptions[${index}] must be an object.`),
      );
      continue;
    }
    assertKeys(
      exception,
      new Set(["id", "owner", "reason", "expiresAt", "remediation"]),
      manifestPath,
      issues,
      `adoption.exceptions[${index}]`,
    );
    assertString(
      exception.id,
      manifestPath,
      issues,
      `adoption.exceptions[${index}].id is required.`,
    );
    assertString(
      exception.owner,
      manifestPath,
      issues,
      `adoption.exceptions[${index}].owner is required.`,
    );
    assertString(
      exception.reason,
      manifestPath,
      issues,
      `adoption.exceptions[${index}].reason is required.`,
    );
    assertDateString(
      exception.expiresAt,
      manifestPath,
      issues,
      `adoption.exceptions[${index}].expiresAt`,
    );
    if (exception.remediation !== undefined) {
      assertString(
        exception.remediation,
        manifestPath,
        issues,
        `adoption.exceptions[${index}].remediation`,
      );
    }
  }
}

function assertKeys(
  value: Record<string, unknown>,
  allowed: Set<string>,
  manifestPath: string,
  issues: Risk[],
  prefix = "",
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.push(
        invalidManifest(manifestPath, `${prefix ? `${prefix}.` : ""}${key} is not allowed.`),
      );
    }
  }
}

function assert(condition: boolean, manifestPath: string, issues: Risk[], message: string): void {
  if (!condition) issues.push(invalidManifest(manifestPath, message));
}

function assertString(value: unknown, manifestPath: string, issues: Risk[], message: string): void {
  if (typeof value !== "string" || value.length === 0) {
    issues.push(invalidManifest(manifestPath, message));
  }
}

function assertStringArray(
  value: unknown,
  manifestPath: string,
  issues: Risk[],
  field: string,
): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    issues.push(invalidManifest(manifestPath, `${field} must be an array of strings.`));
  }
}

function assertEnum(
  value: unknown,
  allowed: Set<string>,
  manifestPath: string,
  issues: Risk[],
  field: string,
): void {
  if (typeof value !== "string" || !allowed.has(value)) {
    issues.push(invalidManifest(manifestPath, `${field} has an unsupported value.`));
  }
}

function assertUri(value: unknown, manifestPath: string, issues: Risk[], field: string): void {
  if (typeof value !== "string") {
    issues.push(invalidManifest(manifestPath, `${field} must be a URI string.`));
    return;
  }
  try {
    new URL(value);
  } catch {
    issues.push(invalidManifest(manifestPath, `${field} must be a valid URI.`));
  }
}

function assertDateString(
  value: unknown,
  manifestPath: string,
  issues: Risk[],
  field: string,
): void {
  if (typeof value !== "string") {
    issues.push(invalidManifest(manifestPath, `${field} must be a date string.`));
    return;
  }
  const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u.exec(value);
  if (!match?.groups) {
    issues.push(invalidManifest(manifestPath, `${field} must be a valid YYYY-MM-DD date.`));
    return;
  }

  const year = Number(match.groups.year);
  const month = Number(match.groups.month);
  const day = Number(match.groups.day);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    issues.push(invalidManifest(manifestPath, `${field} must be a valid YYYY-MM-DD date.`));
  }
}

function invalidManifest(manifestPath: string, message: string): Risk {
  return {
    severity: "error",
    code: "invalid-project-manifest",
    source: manifestPath,
    message: `${manifestPath}: ${message}`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
