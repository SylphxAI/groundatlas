# GroundAtlas

**The source-grounded repository control plane for humans and agents.**

GroundAtlas turns a repository into a deterministic, auditable map of where
truth lives before a human or AI agent changes code. It is deliberately **not a
wiki**, **not an AI memory store**, and **not a second source of truth**. It is
the layer underneath those experiences: the map, truth routing, freshness gate,
and change-control surface that keeps generated context honest.

> OpenWiki can write a wiki. GroundAtlas tells you which source owns the truth,
> whether the generated map is fresh, and what an agent must inspect before it
> touches production code.

```sh
bun install
ga init
ga update
ga audit
ga explain "validation commands"
ga impact --since main
```

The package exposes both `groundatlas` and the short daily-driver command `ga`.
It also exports a typed library API from `groundatlas` for tools that want to
consume the scanner, audit, renderer, explain, and impact primitives directly.

## Why this exists

Modern teams have two bad defaults:

1. **No repo map** — knowledge lives in people, Slack, stale docs, and whatever
   an agent guesses from a partial prompt.
2. **Generated wiki as truth** — prose looks useful, then quietly becomes a
   competing authority that drifts away from code, tests, schemas, ADRs, and
   release evidence.

GroundAtlas takes the third path: generated context is useful, but canonical
truth stays in the files that own it. Delete `.groundatlas/` and no truth should
be lost.

## Current status

Product-ready initial CLI/library slice:

- deterministic scanner and atlas JSON;
- `ga init`, `ga update`, `ga scan`, `ga audit`, `ga explain`, `ga impact`;
- explicit fact-scoped SSOT model and repository orientation route;
- generated Markdown maps with non-SSOT banners;
- freshness audit using file hashes, not just generated prose;
- secret-path skipping and narrow write boundary;
- typed library exports;
- tests, CI, dogfooding, package dry-run, packed-package smoke;
- release workflow prepared for npm provenance publishing.

External package publication is **not complete** until npm trusted publishing or
a bounded npm token is configured and `npm view groundatlas ...` readback proves
the published package.

## What GroundAtlas is

- A CLI-first knowledge control plane for repositories.
- A deterministic read-model over source code, schemas, tests, specs, ADRs,
  manifests, workflows, docs, runbooks, and package metadata.
- A fact-scoped SSOT router: it tells you which file owns which kind of truth.
- A CI-friendly audit gate for generated map integrity and freshness.
- A safe bootstrap for future agent workflows: every map points back to the
  files that own the truth.

## What GroundAtlas is not

- It is not an autonomous code writer.
- It is not an LLM memory store.
- It is not a hosted docs site.
- It is not the canonical source for architecture, API contracts, project
  identity, release status, or implementation behavior.
- It does not read secrets or `.env` files.
- It does not mutate `AGENTS.md`, `CLAUDE.md`, source files, schemas, specs,
  tests, ADRs, workflows, or package manifests.

If deleting `.groundatlas/` would remove important project truth, the project is
using GroundAtlas incorrectly.

## Required truth files for serious adoption

GroundAtlas works best when a repository exposes real truth homes instead of
asking generated docs to invent authority.

| Surface | Required for commercial-grade repos | Owns |
| --- | --- | --- |
| `AGENTS.md` or `CLAUDE.md` | Yes | Local agent adapter and repo hazards. |
| `PROJECT.md` | Yes | Human project identity, lifecycle, boundary, public surfaces, delivery proof. |
| `.doctrine/project.json` | Yes | Machine-readable project manifest and adoption state. |
| `README.md` | Yes | Public start-here promise and install/use contract. |
| `docs/specs/**`, `DESIGN.md`, or `design.md` | Yes | Product intent, operating contracts, acceptance criteria. |
| `docs/adr/**` | Yes once durable decisions exist | Architecture/product/security/commercial decisions. |
| `package.json`, schemas, migrations, exported types | When applicable | Commands, package/API/data contracts, machine surfaces. |
| `src/**`, `lib/**` | When applicable | Implemented behavior. |
| `test/**`, `tests/**`, evals | Yes | Behavior proof and regressions. |
| `.github/workflows/**` | Yes | CI and delivery gates. |
| `docs/runbooks/**`, `SECURITY.md`, `CHANGELOG.md` | Yes for public/customer-facing repos | Operations, security reporting, release/support status. |

GroundAtlas reads these homes, classifies them, and generates a map. It does not
replace them.

See [Source Truth Model](./docs/specs/source-truth-model.md) and [Fleet Adoption
Contract](./docs/specs/fleet-adoption-contract.md).

## SSOT rule

GroundAtlas uses **fact-scoped SSOT**:

- project identity lives in `PROJECT.md` and `.doctrine/project.json`;
- durable decisions live in ADRs;
- product intent lives in specs/design docs;
- contracts live in schemas, exported types, package manifests, and migrations;
- behavior lives in source code;
- behavior proof lives in tests/evals;
- delivery proof lives in workflows, release artifacts, registry readback,
  changelog, and runbooks;
- generated `.groundatlas/**` output is navigation only.

Conflict rule: identify the disputed fact, fix its owning source, run validation,
then run `ga update && ga audit`. Never patch generated output to hide drift.

## How it works

```mermaid
flowchart LR
  A["Repo truth homes"] --> B["Safe scanner"]
  B --> C["Source classifier"]
  C --> D["Atlas JSON with truth model"]
  D --> E["Markdown maps"]
  D --> F["Freshness + non-SSOT audit"]
  D --> G["Explain / impact / future query"]
```

GroundAtlas reads repository metadata and non-secret file hashes through a safe
scanner, classifies files by truth-home type, builds an atlas JSON model, renders
human docs, and audits the result. Generated maps always point back to canonical
source files.

See [Operating Model](./docs/specs/operating-model.md).

## Commands

| Command | Purpose |
| --- | --- |
| `ga init` | Create `groundatlas.config.json` and generated maps under `.groundatlas/`. |
| `ga update` | Refresh generated maps from current repository sources. |
| `ga scan --json` | Inspect sources without writing files. |
| `ga audit` | Verify generated maps, non-SSOT boundary, schema version, error risks, and freshness. |
| `ga explain <query>` | Find source-grounded files related to a query. |
| `ga impact --since <ref>` | Map git diff paths to known atlas sources. |

Aliases: `ingest` → `scan`; `validate` → `audit`; `query` → `explain`; `map` /
`export` → `update`.

## Generated output

`ga init` / `ga update` creates:

```text
.groundatlas/
  atlas.json        # machine-readable source map and truth model
  README.md         # human/agent entry point
  source-map.md     # canonical and supporting sources
  change-guide.md   # validation and handoff guide
```

Every generated Markdown file starts with a banner that says it is generated and
not a source of truth.

## Dogfooding

GroundAtlas dogfoods itself in `bun run check`: it typechecks, tests, lints,
validates the project manifest, builds the CLI, runs the CLI against this
repository, audits generated output freshness/non-SSOT policy, verifies npm
package dry-run, and smoke-installs the packed tarball.

See [Dogfooding Contract](./docs/specs/dogfooding.md).

## Competitive position

| Choice | What you get | What you risk |
| --- | --- | --- |
| No tool | No new dependency. | Slow onboarding, tribal knowledge, stale docs, agent hallucination, weak impact analysis. |
| GroundAtlas | Deterministic source map, truth routing, freshness audit, CLI/library surface, no model key required. | Less magical prose today; citation graph and optional AI adapters are still build-forward work. |
| OpenWiki | AI-generated/maintained `openwiki/` docs and interactive documentation CLI. | Generated docs can become another truth surface; provider/model configuration is central. |
| OpenClaw | Personal AI assistant/gateway across channels, tools, apps, and skills. | Different category; powerful assistant UX but not a repo SSOT/read-model gate by itself. |
| Repo packers / code search / docs sites | Useful context snapshots, search, or polished publishing. | Usually not a project-local truth hierarchy with generated-map freshness gates. |

GroundAtlas is currently ahead on SSOT discipline, deterministic/no-key baseline,
write-boundary safety, and CI-gate posture. It is intentionally behind
LLM-first wiki tools on prose generation and provider integrations until the
source-grounded substrate is trustworthy.

See [Competitive Positioning](./docs/specs/competitive-positioning.md).

## Final product target

GroundAtlas is building toward a complete open-source context control plane:

- source inventory across code, schemas, tests, specs, ADRs, manifests,
  workflows, docs, package metadata, runbooks, and release surfaces;
- deterministic source-grounded atlas generation;
- claim/citation graph with exact source anchors;
- query/explain answers that cite canonical files;
- impact analysis for pull requests and release work;
- freshness and citation validation gates for CI;
- Markdown/HTML output for humans and JSON output for agents/tools;
- optional AI adapters only after the deterministic map is trustworthy;
- MCP/query surfaces and fleet scorecards;
- npm library + CLI distribution with provenance and registry readback.

See [Final Product Goal](./docs/specs/final-product-goal.md).

## Permission model

GroundAtlas is intentionally narrow:

- Reads repository file names, non-secret file metadata, and SHA-256 hashes of
  non-secret files for freshness detection.
- Runs read-only `git` commands (`status`, `rev-parse`, `remote`, `diff`).
- Writes only:
  - `groundatlas.config.json` during `init`;
  - files inside the configured output directory, default `.groundatlas/`.
- Uses no network, no provider API, no LangSmith/tracing, and no hidden remote
  state in the deterministic scan/audit path.

## Development

```sh
bun install
bun run check
```

`bun run check` runs typecheck, tests, Biome, build, CLI help, local GroundAtlas
update/audit, npm pack dry-run, and clean packed-package smoke.

## Library publication

The package name `groundatlas` is currently available on npm, and the repository
contains a release workflow for provenance publishing. Actual npm publication is
blocked until npm trusted publishing or an npm identity/token is configured.

See [Publishing Runbook](./docs/runbooks/publishing.md).
