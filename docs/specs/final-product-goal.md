# Final Product Goal

GroundAtlas should become the open-source knowledge control plane that makes any
repository safe and fast for humans and AI agents to understand.

The target is commercial-grade and beyond wiki-generation: source ownership,
truth routing, citation, impact, freshness, and fleet governance in one small
CLI/library surface.

## Final capability set

1. **Source inventory** — discover code, schemas, tests, specs, ADRs, manifests,
   workflows, docs, package metadata, runbooks, and release surfaces without
   reading secrets.
2. **Fact-scoped SSOT map** — show which canonical file owns each kind of truth.
3. **Orientation route** — tell humans/agents exactly what to read first in a
   new repo.
4. **Source-grounded atlas** — build a deterministic map of canonical truth
   homes, supporting context, public surfaces, validation commands, and risks.
5. **Freshness gate** — prove generated maps match the current non-secret source
   fingerprint.
6. **Claim and citation graph** — extract explicit claims only when they can be
   tied to source paths and, for text/code where possible, exact line ranges.
7. **Agent query layer** — answer `explain` / `query` requests with source-backed
   entries and citations; never answer from generated memory alone.
8. **Impact analysis** — map git changes to affected source homes, docs, tests,
   public surfaces, and release proof.
9. **Freshness/citation validation gates** — fail CI when generated maps lose
   their non-SSOT boundary, source links break, schemas drift, maps are stale, or
   citation claims cannot be traced.
10. **Human documentation outputs** — export Markdown/HTML maps that follow
    mature information architecture: start-here, source map, change guide,
    operations, and validation routes.
11. **Machine outputs** — export stable JSON that future MCP/tools/agents can
    query without scraping Markdown.
12. **Fleet adoption scorecards** — report adopted/warning/blocked/exception
    status across many repositories. The initial shipped surface is
    `ga fleet` / `ga inventory` / `ga score` with adopted/warning/blocked
    status over local checkouts plus neutral manifest validation; exception
    records and remote dashboards remain build-forward work.
13. **Optional AI adapters** — use LLMs only as bounded adapters over the
    deterministic source manifest, with cost controls, privacy controls, and
    citation validation.
14. **Library distribution** — publish the CLI/library through npm with CI-owned
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
- Stale generated maps fail deterministically.
- GroundAtlas can dogfood its own repository in every check.
- Package consumers can install and run the CLI without SylphxAI-private systems.
- Fleet reports separate adopted, warning, blocked, and exception states without
  asking humans to inspect every generated document.
