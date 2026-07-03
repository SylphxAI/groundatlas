export function helpText(): string {
  return `GroundAtlas (ga) — source-grounded knowledge maps for humans and agents.

Usage:
  ga init [--cwd <dir>] [--out <dir>]
  ga update [--cwd <dir>] [--out <dir>]
  ga scan|ingest [--cwd <dir>] [--json]
  ga audit|validate [--cwd <dir>] [--out <dir>] [--json]
  ga explain|query <query> [--cwd <dir>] [--out <dir>] [--json]
  ga impact --since <ref> [--cwd <dir>] [--out <dir>] [--json]
  ga map|export [--cwd <dir>] [--out <dir>]

Commands:
  init      Create groundatlas.config.json and generated map files.
  update    Refresh generated map files from current source truth.
  scan      Inspect repository sources without writing files. Alias: ingest.
  audit     Verify generated maps exist and declare their non-SSOT boundary. Alias: validate.
  explain   Find source-grounded files related to a query. Alias: query.
  impact    Map git diff paths to known atlas sources.
  map       Refresh exported generated maps. Alias: export/update.

GroundAtlas writes only to its configured output directory, plus groundatlas.config.json during init.
Generated maps are navigation aids; code, schemas, tests, ADRs, manifests, and workflows remain canonical.`;
}
