# GroundAtlas Project

GroundAtlas is an open-source, CLI-first knowledge control plane that generates
source-grounded repository maps for humans and AI agents.

## Lifecycle

- State: `active`, with public npm package `groundatlas@0.1.1`
- Layer: `tooling`
- Policy pool: `agent-tool`
- Local machine manifest: [`.doctrine/project.json`](./.doctrine/project.json) (SylphxAI Doctrine adapter; not a public GroundAtlas requirement)

## Final goals

- Help humans and agents enter unfamiliar repositories faster without treating
  generated prose as truth.
- Produce deterministic maps over source code, schemas, tests, specs, ADRs,
  manifests, workflows, docs, runbooks, and package metadata.
- Provide safe CLI primitives for init, update, audit, explain, scan, impact,
  ingest, map, query, validate, and export workflows.
- Expose a typed library API so other tools can use GroundAtlas without shelling
  out to the CLI.
- Build toward claim/citation graph extraction, stronger freshness/citation gates,
  CI impact checks, fleet scorecards, MCP/query surfaces, and optional AI
  adapters over deterministic source manifests.
- Publish as an open npm library/CLI with provenance and registry readback.
- Keep generated maps reproducible, source-linked, and deletable.

## Non-goals

- GroundAtlas does not own downstream repository architecture decisions.
- GroundAtlas does not replace ADRs, specs, schemas, tests, project manifests,
  runbooks, package manifests, CI workflows, or source code.
- GroundAtlas does not mutate source files or root agent prompts.
- GroundAtlas does not require LLM/provider credentials in the deterministic scan/audit path.

## Boundary

GroundAtlas owns the generated map format, fact-scoped SSOT/orientation model,
CLI behavior, scanner, renderers, audit gate, and documentation for using the
tool. The repository being scanned owns all canonical facts that GroundAtlas points to.

## Public surfaces

- CLI binaries: `groundatlas`, `ga`
- Published npm package: [`groundatlas`](https://www.npmjs.com/package/groundatlas)
- Package manifest: [`package.json`](./package.json)
- Generated map schema shape: [`src/domain/types.ts`](./src/domain/types.ts)
- User docs: [`README.md`](./README.md)
- Repo-local agent adapter: [`AGENTS.md`](./AGENTS.md)
- Local project manifest adapter: [`.doctrine/project.json`](./.doctrine/project.json)

## Operating principle

GroundAtlas is a derived read-model over repository truth. The scanner reads non-secret source metadata and SHA-256 hashes, the
classifier identifies truth-home types, the atlas model records source entries, orientation
routes, truth homes, and risks, renderers create human maps, and audit commands
enforce freshness plus the non-SSOT boundary.

## Dogfooding

GroundAtlas must use GroundAtlas on itself. `bun run check` builds the product,
regenerates its own atlas, audits generated-map freshness/non-SSOT boundaries,
and verifies package dry-run contents plus packed-package smoke. Features that
cannot safely run on this repository are not defaults.

## Delivery

This repository is delivered through GitHub, CI, and source commits. Package
publication runs through the tag-gated `.github/workflows/release.yml` workflow
with provenance, registry readback, post-publish dogfood, and release evidence
artifacts. `groundatlas@0.1.1` is published; the remaining release-infrastructure
gap is migration from the bounded `NPM_TOKEN` bootstrap fallback to npm trusted
publishing/OIDC. Manual local publish is not the standard path.
