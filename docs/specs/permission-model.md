# Permission Model

GroundAtlas follows least privilege by default.

## Read access

The scanner reads repository directory entries and file metadata. It skips common
build/cache directories and secret-looking files, including `.env`, private key
extensions, and secret/private directories.

## Write access

The CLI writes only:

- `groundatlas.config.json` during `ga init`;
- generated output under the configured `outputDir`, default `.groundatlas/`.

No command writes to `AGENTS.md`, `CLAUDE.md`, source files, tests, schemas,
ADRs, workflows, or package manifests.

## Process/network access

The MVP executes read-only `git` commands and performs no network calls.
Future adapters that use model providers, tracing, MCP, or remote sources must
be optional, documented, and separately gated.
