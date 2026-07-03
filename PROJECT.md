# GroundAtlas Project

GroundAtlas is an open-source, CLI-first knowledge control plane that generates
source-grounded repository maps for humans and AI agents.

## Lifecycle

- State: `active`
- Layer: `tooling`
- Policy pool: `agent-tool`
- Machine manifest: [`.doctrine/project.json`](./.doctrine/project.json)

## Final goals

- Help humans and agents enter unfamiliar repositories faster without treating
  generated prose as truth.
- Produce deterministic maps over source code, schemas, tests, ADRs, manifests,
  workflows, docs, and package metadata.
- Provide safe CLI primitives for init, update, audit, explain, scan, impact,
  ingest, map, query, validate, and export workflows.
- Expose a typed library API so other tools can use GroundAtlas without shelling
  out to the CLI.
- Build toward claim/citation graph extraction, freshness gates, CI impact
  checks, MCP/query surfaces, and optional AI adapters over deterministic source
  manifests.
- Publish as an open npm library/CLI with provenance and registry readback.
- Keep generated maps reproducible, source-linked, and deletable.

## Non-goals

- GroundAtlas does not own downstream repository architecture decisions.
- GroundAtlas does not replace ADRs, specs, schemas, tests, project manifests,
  runbooks, package manifests, CI workflows, or source code.
- GroundAtlas does not mutate source files or root agent prompts.
- GroundAtlas does not require LLM/provider credentials in the MVP.

## Boundary

GroundAtlas owns the generated map format, CLI behavior, scanner, renderers,
audit gate, and documentation for using the tool. The repository being scanned
owns all canonical facts that GroundAtlas points to.

## Public surfaces

- CLI binaries: `groundatlas`, `ga`
- Package manifest: [`package.json`](./package.json)
- Generated map schema shape: [`src/domain/types.ts`](./src/domain/types.ts)
- User docs: [`README.md`](./README.md)
- Repo-local agent adapter: [`AGENTS.md`](./AGENTS.md)
- Project manifest: [`.doctrine/project.json`](./.doctrine/project.json)

## Operating principle

GroundAtlas is a derived read-model over repository truth. The scanner reads
non-secret source metadata, the classifier identifies truth-home types, the atlas
model records source entries and risks, renderers create human maps, and audit
commands enforce the non-SSOT boundary.

## Dogfooding

GroundAtlas must use GroundAtlas on itself. `bun run check` builds the product,
regenerates its own atlas, audits the generated map, and verifies package dry-run
contents. Features that cannot safely run on this repository are not defaults.

## Delivery

This repository is delivered through GitHub, CI, and source commits. Package
publication is prepared through `.github/workflows/release.yml`; actual npm
publication requires npm trusted publishing or an npm identity/token, then
registry readback. Manual local publish is not the standard path.
