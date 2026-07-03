# ADR-0002: Source-grounded control plane before generated wiki or AI memory

- Status: Accepted
- Date: 2026-07-03
- Scope: GroundAtlas product architecture, adoption contract, and public positioning

## Context

GroundAtlas is intended for many repositories and for both humans and AI agents.
The easy path would be to generate a wiki-like document tree and let that prose
become the place people read first. That would improve onboarding, but it would
also create a second source of truth and make drift harder to detect.

Public tools such as OpenWiki focus on AI-maintained documentation. Personal
assistant systems such as OpenClaw solve a different problem: operator-facing AI
assistance across channels/tools. GroundAtlas needs its own durable category:
source-grounded repository control plane.

## Decision

GroundAtlas will be deterministic-first and SSOT-safe:

1. Generated artifacts are navigation/read-model outputs, not truth.
2. Every map must point back to owning repository truth homes.
3. The scanner must avoid secrets and must not mutate scanned source files,
   ADRs, specs, schemas, tests, `AGENTS.md`, or tool-specific agent adapters.
4. The atlas will expose an explicit fact-scoped truth model and orientation
   route so agents know what to read first.
5. Optional AI adapters may be added only after deterministic scan/audit/freshness
   gates are trustworthy.
6. Fleet adoption requires project manifests, specs/design docs, ADRs, tests,
   CI, security/runbook surfaces, and generated-output auditability.

## Consequences

Positive:

- Lower SSOT risk than generated-wiki-first products.
- Safer baseline for agent automation and CI gates.
- Clear market positioning: not "another wiki", but the governed substrate under
  repo understanding.
- Generated output can be deleted and recreated without losing project truth.

Trade-offs:

- Less magical prose than LLM-first wiki tools in the initial product slice.
- More pressure on repositories to maintain real truth homes (`PROJECT.md`, ADRs,
  specs, tests, schemas, workflows) instead of outsourcing truth to generated docs.
- AI features must remain bounded adapters, which slows novelty but protects trust.

## Acceptance criteria

- `AtlasMap` includes an explicit truth model and orientation route.
- Classifier recognizes specs/design docs separately from tests.
- README explains GroundAtlas vs no tool, OpenWiki, OpenClaw, and adjacent tools.
- Docs define required files, SSOT hierarchy, conflict rules, and fleet adoption gates.
- `bun run check` passes after the change.
