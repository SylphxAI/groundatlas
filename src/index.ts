export { auditAtlas } from "./application/audit.js";
export { CONFIG_FILE_NAME, defaultConfig, ensureConfig, loadConfig } from "./application/config.js";
export { explainQuery } from "./application/explain.js";
export { inspectFleet } from "./application/fleet.js";
export { writeAtlas } from "./application/generate.js";
export { analyzeImpact } from "./application/impact.js";
export {
  inspectMachineProjectManifest,
  inspectMachineProjectManifests,
  validateMachineProjectManifestFile,
  validateProjectManifestFile,
} from "./application/projectManifest.js";
export { scanRepository } from "./application/scan.js";
export { classifySource } from "./domain/classify.js";
export type {
  AtlasMap,
  AuditResult,
  FleetAdoptionStatus,
  FleetProjectReport,
  FleetReport,
  GitState,
  GroundAtlasConfig,
  ImpactEntry,
  MachineManifestInspection,
  MachineManifestKind,
  MachineManifestReport,
  OrientationStep,
  PublicSurface,
  RepoIdentity,
  Risk,
  RiskSeverity,
  ScanOptions,
  SourceEntry,
  SourceKind,
  TruthHome,
  ValidationCommand,
} from "./domain/types.js";
export {
  AGENT_ADAPTER_PATHS,
  ATLAS_SCHEMA_VERSION,
  CONFIG_SCHEMA_VERSION,
  DEFAULT_OUTPUT_DIR,
  GENERATED_BANNER,
  MACHINE_PROJECT_MANIFEST_PATHS,
} from "./domain/types.js";
export {
  renderFleetReport,
  renderGeneratedHeader,
  renderImpact,
  renderOrientation,
  renderReadme,
  renderRisks,
  renderSourceMap,
  renderSourceTable,
  renderTruthHomes,
} from "./renderers/markdown.js";
