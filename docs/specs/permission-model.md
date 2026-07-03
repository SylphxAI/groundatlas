# Permission Model

GroundAtlas follows least privilege by default.

## Read access

The scanner reads repository directory entries, file metadata, and SHA-256 hashes
for non-secret files. Hashes are used to prove generated-map freshness without
storing source contents in the atlas.

It skips common build/cache directories and secret-looking files, including
`.env`, private key extensions, and secret/private directories.

## Write access

The CLI writes only:

- `groundatlas.config.json` during `ga init`;
- generated output under the configured `outputDir`, default `.groundatlas/`.

No command writes to `AGENTS.md`, tool-specific agent adapters such as
`CLAUDE.md`, source files, tests, schemas, specs, ADRs, workflows, package
manifests, or runbooks.

## Process/network access

The deterministic path executes read-only `git` commands and performs no network
calls. Future adapters that use model providers, tracing, MCP, or remote sources
must be optional, documented, and separately gated.
