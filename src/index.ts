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
  PublicSurface,
  RepoIdentity,
  Risk,
  RiskSeverity,
  ScanOptions,
  SourceEntry,
  SourceKind,
  ValidationCommand,
} from "./domain/types.js";
export { ATLAS_SCHEMA_VERSION, DEFAULT_OUTPUT_DIR, GENERATED_BANNER } from "./domain/types.js";
export {
  renderGeneratedHeader,
  renderImpact,
  renderReadme,
  renderRisks,
  renderSourceMap,
  renderSourceTable,
} from "./renderers/markdown.js";
