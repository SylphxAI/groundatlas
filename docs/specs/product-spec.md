# GroundAtlas Product Spec

## Goal

Create a source-grounded map of a repository so humans and AI agents can find
canonical truth quickly without converting generated docs into a second source
of truth. The final product is both a CLI and a typed library for building,
validating, querying, and exporting repository knowledge maps.

GroundAtlas is not positioned as an MVP wiki generator. It is a commercial-grade
repository context control plane: deterministic first, SSOT-safe, CI-gateable,
and ready to become the substrate for optional AI/citation features.

## Users

- Developers entering an unfamiliar repository.
- AI coding agents that need a safe orientation layer.
- Maintainers who want CI-detectable documentation/context drift.
- Platform/enablement teams rolling consistent repo-understanding rules across
  many projects.

## Final product functions

- Source inventory and classification.
- Fact-scoped SSOT model and orientation route.
- Deterministic atlas JSON generation.
- Markdown/HTML and machine JSON exports.
- Generated-map freshness audit.
- Claim/citation graph with exact source anchors.
- Query/explain with citations only.
- PR impact analysis and freshness gates.
- Fleet adoption scorecards and exception records.
- Optional AI adapters over deterministic source manifests.
- npm library + CLI distribution with provenance.

## Current verified production-foundation workflows

1. `ga init` creates config plus generated maps.
2. `ga update` refreshes maps from current source truth.
3. `ga scan` inspects the repository without writes.
4. `ga audit` verifies generated maps, schema version, non-SSOT banners,
   source-owned error risks, and freshness against the current scan.
5. `ga explain <query>` finds source-grounded files related to a topic.
6. `ga impact --since <ref>` maps changed files to known sources.
7. `groundatlas` library exports scanner, audit, explain, impact, and renderer primitives.
8. Release workflow performs npm dry-run and is ready for provenance publish.

## Invariants

- Generated maps are deletable and reproducible.
- Canonical truth remains in source code, schemas, tests, specs, ADRs,
  manifests, workflows, package metadata, project docs, and release proof.
- No secret-bearing files are read.
- Non-secret file hashes may be read to prove generated-map freshness, but file
  contents are not stored in the atlas.
- No scanned source files are mutated.
- No network or model provider is required in the deterministic scan/audit path.

## Acceptance criteria

- Clean checkout passes `bun run check`.
- `ga init` writes only `groundatlas.config.json` and `.groundatlas/**`.
- `ga audit` fails if generated Markdown files lose the generated/non-SSOT
  banner.
- `ga audit` fails if `.groundatlas/atlas.json` is stale against current sources.
- `ga scan --json` exposes the truth model and orientation route.
- `ga explain` returns source entries with paths and reasons.
- `ga impact --since <ref>` returns a deterministic table or JSON.
