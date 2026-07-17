# GroundAtlas Project

> **RETIRING PRODUCT (2026-07-17).** The independent OSS product thesis is
> **rejected**. Repository scanning is absorbed as Control Plane **Repository
> Ingestion**. See
> [ADR-DRAFT-product-retirement-into-control-plane](./docs/adr/ADR-DRAFT-product-retirement-into-control-plane.md)
> and Control Plane ADR-0014.
>
> Do **not** start new product features, fleet dogfood expansions, or committed-atlas
> SSOT work. Compatibility maintenance only until Yes-class consumers unhook.

GroundAtlas was an open-source, CLI-first scanner that generated source-grounded
repository maps. That packaging is deprecated as a sold product.

## Lifecycle

- State: **`retiring`** (public npm `groundatlas@0.1.3` still published; no new feature investment)
- Layer: `tooling` (legacy)
- Policy pool: `agent-tool`
- Target absorption: SylphxAI Control Plane Repository Ingestion
- Local machine manifest: [`.doctrine/project.json`](./.doctrine/project.json)

## Final goals (retirement path)

- Complete orderly consumer unhook (Doctrine dogfood, skills, tsnum, consultant-mcp, …).
- Preserve scanner algorithms as potential Control Plane internal engine inputs.
- Deprecate npm package with replacement pointer to Control Plane SaaS.
- Archive this repository only after honest Yes-class reverse deps are zero.
- Stop selling per-repo CLI install + committed maps as customer outcome.

## Non-goals

- New product features, public marketplace growth, or dual-engine product investment.
- Treating committed `.groundatlas/**` maps as source of truth.
- Owning Work Graph / claims / live portfolio state (Control Plane).
- Mutating scanned repository source files.

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
artifacts. `groundatlas@0.1.3` is published; the remaining release-infrastructure
gap is migration from the bounded `NPM_TOKEN` bootstrap fallback to npm trusted
publishing/OIDC. Manual local publish is not the standard path.
