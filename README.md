# GroundAtlas

**Source-grounded knowledge maps for humans and agents.**

GroundAtlas turns a repository into a deterministic, source-linked context map
that helps humans and AI agents understand where truth lives before changing
code. It is inspired by mature human documentation practice and agent-native
repo mapping, but it is deliberately **not** a wiki and **not** a second source
of truth.

```sh
bun install
ga init
ga audit
ga explain "validation commands"
ga impact --since main
```

The package exposes both `groundatlas` and the short daily-driver command `ga`.

## What GroundAtlas is

- A CLI-first knowledge control plane for repositories.
- A generated navigation layer over source code, schemas, tests, ADRs,
  manifests, workflows, and docs.
- A deterministic scanner and renderer that can run in CI without model keys.
- A safe bootstrap for future agent workflows: every map points back to the
  files that own the truth.

## What GroundAtlas is not

- It is not an autonomous code writer.
- It is not an LLM memory store.
- It is not the canonical source for architecture, API contracts, project
  identity, or release status.
- It does not read secrets or `.env` files.
- It does not mutate `AGENTS.md`, `CLAUDE.md`, source files, schemas, tests, or
  ADRs.

If deleting `.groundatlas/` would remove important project truth, the project is
using GroundAtlas incorrectly.

## Commands

| Command | Purpose |
| --- | --- |
| `ga init` | Create `groundatlas.config.json` and generated maps under `.groundatlas/`. |
| `ga update` | Refresh generated maps from current repository sources. |
| `ga scan --json` | Inspect sources without writing files. |
| `ga audit` | Verify generated maps exist and declare the non-SSOT boundary. |
| `ga explain <query>` | Find source-grounded files related to a query. |
| `ga impact --since <ref>` | Map git diff paths to known atlas sources. |

## Permission model

GroundAtlas is intentionally narrow:

- Reads repository file names and non-secret file metadata.
- Runs read-only `git` commands (`status`, `rev-parse`, `remote`, `diff`).
- Writes only:
  - `groundatlas.config.json` during `init`;
  - files inside the configured output directory, default `.groundatlas/`.
- Uses no network, no provider API, no LangSmith/tracing, and no hidden remote
  state in the MVP.

## Generated output

`ga init` / `ga update` creates:

```text
.groundatlas/
  atlas.json        # machine-readable source map
  README.md         # human/agent entry point
  source-map.md     # canonical and supporting sources
  change-guide.md   # validation and handoff guide
```

Every generated Markdown file starts with a banner that says it is generated and
not a source of truth.

## Development

```sh
bun install
bun run check
```

`bun run check` runs typecheck, tests, Biome, build, CLI help, and the local
GroundAtlas audit.

## Status

Initial product-ready slice: deterministic CLI, generated maps, audit gate,
project manifest, governance docs, tests, and CI. LLM-assisted claim extraction,
MCP, hosted UI, and package publishing are future slices after the deterministic
core proves the boundary.
