import path from "node:path";
import type { AtlasMap, SourceEntry } from "../domain/types.ts";
import { readJsonFile } from "../infrastructure/fs.ts";
import { scanRepository } from "./scan.ts";

export async function explainQuery(
  cwd: string,
  outputDir: string,
  query: string,
): Promise<SourceEntry[]> {
  const atlasPath = path.join(cwd, outputDir, "atlas.json");
  const atlas =
    (await readJsonFile<AtlasMap>(atlasPath)) ?? (await scanRepository({ cwd, outputDir }));
  const terms = query.toLowerCase().split(/\s+/u).filter(Boolean);
  return atlas.sources
    .map((source) => ({ source, score: scoreSource(source, terms) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.source.path.localeCompare(right.source.path),
    )
    .slice(0, 20)
    .map((entry) => entry.source);
}

function scoreSource(source: SourceEntry, terms: string[]): number {
  const haystack = `${source.path} ${source.kind} ${source.reason}`.toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}
