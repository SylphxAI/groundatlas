export { auditAtlas } from "./application/audit.js";
export { CONFIG_FILE_NAME, defaultConfig, ensureConfig, loadConfig } from "./application/config.js";
export { explainQuery } from "./application/explain.js";
export { writeAtlas } from "./application/generate.js";
export { analyzeImpact } from "./application/impact.js";
export { scanRepository } from "./application/scan.js";
export { classifySource } from "./domain/classify.js";
export type {
  AtlasMap,
  AuditResult,
  GitState,
  GroundAtlasConfig,
  ImpactEntry,
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
  ATLAS_SCHEMA_VERSION,
  CONFIG_SCHEMA_VERSION,
  DEFAULT_OUTPUT_DIR,
  GENERATED_BANNER,
} from "./domain/types.js";
export {
  renderGeneratedHeader,
  renderImpact,
  renderOrientation,
  renderReadme,
  renderRisks,
  renderSourceMap,
  renderSourceTable,
  renderTruthHomes,
} from "./renderers/markdown.js";
