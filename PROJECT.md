# GroundAtlas Project

GroundAtlas is an open-source, CLI-first knowledge control plane that generates
source-grounded repository maps for humans and AI agents.

## Lifecycle

- State: `active`
- Layer: `tooling`
- Policy pool: `agent-tool`
- Machine manifest: [`.doctrine/project.json`](./.doctrine/project.json)

## Goals

- Help humans and agents enter unfamiliar repositories faster without treating
  generated prose as truth.
- Produce deterministic maps over source code, schemas, tests, ADRs, manifests,
  workflows, docs, and package metadata.
- Provide safe CLI primitives for init, update, audit, explain, scan, and impact
  analysis.
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

## Delivery

This repository is delivered through GitHub, CI, and source commits. Package
publication is not enabled in the initial slice; when enabled, release delivery
must use CI-owned provenance and registry readback, not manual local publish.
