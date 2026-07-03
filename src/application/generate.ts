import path from "node:path";
import type { AtlasMap } from "../domain/types.js";
import { readJsonFile, writeTextFile } from "../infrastructure/fs.js";
import { renderChangeGuide, renderReadme, renderSourceMap } from "../renderers/markdown.js";
import { freshnessFingerprint } from "./audit.js";

export async function writeAtlas(outputRoot: string, map: AtlasMap): Promise<string[]> {
  const stableMap = await preserveVolatileFieldsWhenFresh(outputRoot, map);
  const files = [
    { path: "atlas.json", content: `${JSON.stringify(stableMap, null, 2)}\n` },
    { path: "README.md", content: renderReadme(stableMap) },
    { path: "source-map.md", content: renderSourceMap(stableMap) },
    { path: "change-guide.md", content: renderChangeGuide(stableMap) },
  ];
  for (const file of files) {
    await writeTextFile(path.join(outputRoot, file.path), file.content);
  }
  return files.map((file) => path.join(outputRoot, file.path));
}

async function preserveVolatileFieldsWhenFresh(
  outputRoot: string,
  map: AtlasMap,
): Promise<AtlasMap> {
  const existing = await readJsonFile<AtlasMap>(path.join(outputRoot, "atlas.json"));
  if (!existing) return map;
  if (freshnessFingerprint(existing) !== freshnessFingerprint(map)) return map;
  return {
    ...map,
    generatedAt: existing.generatedAt,
    repository: {
      ...map.repository,
      root: existing.repository?.root ?? map.repository.root,
      git: existing.repository?.git ?? map.repository.git,
    },
  };
}
