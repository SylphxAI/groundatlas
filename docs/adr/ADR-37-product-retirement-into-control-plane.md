# ADR-37: GroundAtlas product retirement into Control Plane Repository Ingestion

- Status: **proposed** (introducing PR #37; accepted when merged)
- Date: 2026-07-17
- Owner: SylphxAI/groundatlas
- Portable slug: `SylphxAI/groundatlas:product-retirement-into-control-plane`
- Coordinates with: Control Plane [ADR-0014](https://github.com/SylphxAI/control-plane/blob/main/docs/adr/ADR-0014-groundatlas-product-retirement-cp-ingestion.md)

## Context

GroundAtlas packaged repository scanning as a per-repo OSS CLI/action that
commits generated maps and dogfoods across the fleet. That product form fails
commercial and operational review: high install cost, low paid outcome, and
self-inflicted projection drift.

Control Plane ADR-0014 rejects the independent product thesis and absorbs the
scanning capability as **Repository Ingestion** inside Control Plane SaaS.

## Decision

1. **Stop** product-feature development (CLI product surface, committed-atlas SSOT,
   fleet dogfood as adoption metric, greenfield dual-engine product investment).
2. **Lifecycle** becomes `retiring` → `archived` after Yes-class consumers unhook.
3. Scanner/classifier code may be **moved or reimplemented** under Control Plane;
   this repo is not a permanent product home.
4. npm package `groundatlas` is **deprecated** (docs immediately; registry
   deprecation when cutover-ready) with replacement: Control Plane SaaS /
   Repository Ingestion — not a successor CLI brand.
5. Archive only when honest reverse deps are zero (package pins, workflow uses,
   required checks) — **not** when code-search hits drop.

## Non-goals

- Big-bang delete of public package while consumers remain
- Renaming this repo forever as a public product
- Claiming archive safety from documentation cleanup alone

## Consequences

- PROJECT.md / README state retirement
- Supersede ADR-168 “fleet GroundAtlas rust north star” as product direction
  (scanner tech may still inform CP internal engine)
- Consumers must unhook CI dogfood
