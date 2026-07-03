# GroundAtlas Product Spec

## Goal

Create a source-grounded map of a repository so humans and AI agents can find
canonical truth quickly without converting generated docs into a second source
of truth.

## Users

- Developers entering an unfamiliar repository.
- AI coding agents that need a safe orientation layer.
- Maintainers who want CI-detectable documentation/context drift.

## MVP workflows

1. `ga init` creates config plus generated maps.
2. `ga update` refreshes maps from current source truth.
3. `ga scan` inspects the repository without writes.
4. `ga audit` verifies generated maps and non-SSOT banners.
5. `ga explain <query>` finds source-grounded files related to a topic.
6. `ga impact --since <ref>` maps changed files to known sources.

## Invariants

- Generated maps are deletable and reproducible.
- Canonical truth remains in source code, schemas, tests, ADRs, manifests,
  workflows, package metadata, and project docs.
- No secret-bearing files are read.
- No scanned source files are mutated.
- No network or model provider is required in the MVP.

## Acceptance criteria

- Clean checkout passes `bun run check`.
- `ga init` writes only `groundatlas.config.json` and `.groundatlas/**`.
- `ga audit` fails if generated Markdown files lose the generated/non-SSOT
  banner.
- `ga explain` returns source entries with paths and reasons.
- `ga impact --since <ref>` returns a deterministic table or JSON.
