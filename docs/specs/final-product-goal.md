# Final Product Goal

GroundAtlas should become the open-source knowledge control plane that makes any
repository safe and fast for humans and AI agents to understand.

## Final capability set

1. **Source inventory** — discover code, schemas, tests, ADRs, manifests,
   workflows, docs, package metadata, and runbooks without reading secrets.
2. **Source-grounded atlas** — build a deterministic map of canonical truth
   homes, supporting context, public surfaces, validation commands, and risks.
3. **Claim and citation graph** — extract explicit claims only when they can be
   tied to source paths and, for text/code where possible, exact line ranges.
4. **Agent query layer** — answer `explain` / `query` requests with source-backed
   entries and citations; never answer from generated memory alone.
5. **Impact analysis** — map git changes to affected source homes, docs, tests,
   and public surfaces.
6. **Freshness/audit gates** — fail CI when generated maps lose their non-SSOT
   boundary, source links break, schemas drift, or maps are stale.
7. **Human documentation outputs** — export Markdown/HTML maps that follow mature
   information architecture: start-here, source map, change guide, operations,
   and validation routes.
8. **Machine outputs** — export stable JSON that future MCP/tools/agents can
   query without scraping Markdown.
9. **Optional AI adapters** — use LLMs only as bounded adapters over the
   deterministic source manifest, with cost controls, privacy controls, and
   citation validation.
10. **Library distribution** — publish the CLI/library through npm with CI-owned
    provenance and registry readback.

## Product promise

> GroundAtlas makes generated context useful without letting generated context
> become authority.

Generated maps are always deletable. If deleting `.groundatlas/` or any exported
GroundAtlas artifact loses project truth, the project is using GroundAtlas
incorrectly.

## Success metrics

- New-agent orientation time drops materially on real repositories.
- Every generated claim links to a canonical source home.
- `ga audit` is useful as a CI gate, not just an advisory report.
- GroundAtlas can dogfood its own repository in every check.
- Package consumers can install and run the CLI without SylphxAI-private systems.
