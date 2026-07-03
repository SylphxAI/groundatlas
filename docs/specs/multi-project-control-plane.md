# Multi-project Control Plane

GroundAtlas should stay useful to any repository, not only repositories that use
SylphxAI Doctrine. The public product needs a vendor-neutral project manifest
contract and a separate multi-project control-plane layer.

## Why `.doctrine/project.json` is not the public default

`.doctrine/project.json` is a SylphxAI Doctrine adapter. It is valuable for
SylphxAI repositories because it connects local project identity to the company
Doctrine, but it would be wrong to make it the universal public requirement.

Public GroundAtlas must instead speak in terms of a generic capability:

> A repository may expose a machine-readable project manifest. GroundAtlas can
> read neutral manifests first and ecosystem-specific adapters when present.

## Neutral manifest candidates

GroundAtlas recognizes these vendor-neutral machine project manifest paths:

- `project.manifest.json` (public default)
- `groundatlas.project.json` (compatibility alias)
- `.project/manifest.json`

It may also recognize ecosystem adapters, including:

- `.doctrine/project.json` for SylphxAI Doctrine repositories;
- future Backstage/catalog, OpenAPI, package-manager workspace, or monorepo
  inventory adapters when they can be read without taking ownership of truth.

## Separate library direction

A future open-source package should own the reusable multi-project control-plane
primitive instead of forcing every repo to adopt SylphxAI naming.

Working name: **Project Atlas Manifest**. Final package/repo name is a public
contract and should be decided before creation.

The package should provide:

1. a vendor-neutral project manifest schema;
2. validators and typed parsers;
3. adapters for `.doctrine/project.json` and other ecosystem manifests;
4. fleet inventory aggregation across many repos;
5. status states such as adopted, warning, blocked, exception, and unknown;
6. machine-readable exception records with owner, expiry, and remediation path;
7. outputs that GroundAtlas can consume without depending on SylphxAI-private
   doctrine.

## Boundary with GroundAtlas

GroundAtlas owns repository scanning, generated maps, truth routing, and audit
freshness. The future control-plane library owns cross-repository inventory,
manifest schema/adapters, fleet scorecards, and exception records.

GroundAtlas may consume that library once it exists, but GroundAtlas must remain
usable without it.

See also: [Control-plane Business Case](./control-plane-business-case.md).
