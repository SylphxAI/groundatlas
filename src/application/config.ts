import path from "node:path";
import {
  ATLAS_SCHEMA_VERSION,
  DEFAULT_OUTPUT_DIR,
  type GroundAtlasConfig,
} from "../domain/types.js";
import { pathExists, readJsonFile, writeTextFile } from "../infrastructure/fs.js";

export const CONFIG_FILE_NAME = "groundatlas.config.json";

export function defaultConfig(): GroundAtlasConfig {
  return {
    schemaVersion: ATLAS_SCHEMA_VERSION,
    outputDir: DEFAULT_OUTPUT_DIR,
    include: ["**/*"],
    exclude: [".git", "node_modules", "dist", "build", "coverage", DEFAULT_OUTPUT_DIR],
    generatedDocsAreNotSsot: true,
  };
}

export async function loadConfig(
  cwd: string,
  explicitOutputDir?: string,
): Promise<GroundAtlasConfig> {
  const configPath = path.join(cwd, CONFIG_FILE_NAME);
  const fileConfig = await readJsonFile<Partial<GroundAtlasConfig>>(configPath);
  return {
    ...defaultConfig(),
    ...fileConfig,
    outputDir: explicitOutputDir ?? fileConfig?.outputDir ?? DEFAULT_OUTPUT_DIR,
    generatedDocsAreNotSsot: true,
    schemaVersion: ATLAS_SCHEMA_VERSION,
  };
}

export async function ensureConfig(cwd: string, outputDir?: string): Promise<GroundAtlasConfig> {
  const config = await loadConfig(cwd, outputDir);
  const configPath = path.join(cwd, CONFIG_FILE_NAME);
  if (!(await pathExists(configPath))) {
    await writeTextFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  }
  return config;
}
