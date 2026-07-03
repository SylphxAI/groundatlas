import type { AtlasMap, ImpactEntry } from "../domain/types.js";
import { readGitDiff } from "../infrastructure/git.js";

export async function analyzeImpact(
  cwd: string,
  since: string,
  atlas: AtlasMap,
): Promise<ImpactEntry[]> {
  const diff = await readGitDiff(cwd, since);
  return diff.map((entry) => ({
    ...entry,
    matchedSources: atlas.sources.filter(
      (source) =>
        source.path === entry.path ||
        source.path.startsWith(`${entry.path}/`) ||
        entry.path.startsWith(`${source.path}/`),
    ),
  }));
}
