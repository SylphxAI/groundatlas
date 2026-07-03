import path from "node:path";
import type { AtlasMap } from "../domain/types.js";
import { writeTextFile } from "../infrastructure/fs.js";
import { renderChangeGuide, renderReadme, renderSourceMap } from "../renderers/markdown.js";

export async function writeAtlas(outputRoot: string, map: AtlasMap): Promise<string[]> {
  const files = [
    { path: "atlas.json", content: `${JSON.stringify(map, null, 2)}\n` },
    { path: "README.md", content: renderReadme(map) },
    { path: "source-map.md", content: renderSourceMap(map) },
    { path: "change-guide.md", content: renderChangeGuide(map) },
  ];
  for (const file of files) {
    await writeTextFile(path.join(outputRoot, file.path), file.content);
  }
  return files.map((file) => path.join(outputRoot, file.path));
}
