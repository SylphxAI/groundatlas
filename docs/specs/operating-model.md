# Operating Model

GroundAtlas is a read-model over repository truth.

```mermaid
flowchart LR
  A["Repository truth homes"] --> B["Safe scanner"]
  B --> C["Source classifier"]
  C --> D["Atlas model (JSON)"]
  D --> E["Markdown/HTML renderers"]
  D --> F["Audit / freshness gate"]
  D --> G["Explain / query / impact commands"]
```

## Source hierarchy

GroundAtlas uses a fact-scoped SSOT model. It treats these as canonical truth
homes, in the domain they own:

1. `PROJECT.md` plus a machine project manifest for project identity,
   lifecycle, boundary, public surfaces, adoption state, and delivery proof.
   Preferred neutral manifest is `project.manifest.json`; `groundatlas.project.json`
   and `.project/manifest.json` are compatibility aliases; ecosystem adapters such
   as `.doctrine/project.json` are detected when present.
2. `AGENTS.md` as the preferred tool-neutral runtime adapter. Tool-specific
   adapters such as `CLAUDE.md`, `.cursor/rules`, or
   `.github/copilot-instructions.md` are optional detected inputs, not public
   requirements.
3. `README.md` for the public start-here promise.
4. Specs/design docs (`docs/specs/**`, `DESIGN.md`, `design.md`) for product
   intent, operating contracts, and acceptance criteria.
5. ADRs (`docs/adr/**`) for durable decisions.
6. Source code, schemas, migrations, exported types, package manifests, and CLI
   help for implemented behavior and machine-checkable contracts.
7. Tests/evals for behavior proof.
8. Workflows, runbooks, `SECURITY.md`, changelog, and release artifacts for
   validation, operations, support, and release truth.

Generated maps link to those homes. They do not override them.

## Command flow

- `ga init` writes `groundatlas.config.json` plus generated output.
- `ga scan` / `ga ingest` reads the repo and emits a source model without writes.
- `ga update` / `ga map` / `ga export` refreshes `.groundatlas/**` from current
  source truth.
- `ga audit` / `ga validate` checks that generated output exists, remains marked
  as generated, uses the expected schema, carries no source-owned error risks,
  and is fresh against the current scan.
- `ga explain` / `ga query` finds relevant source entries for a topic.
- `ga impact --since <ref>` maps changed files to atlas entries.

## Design rules

- Deterministic core first; AI is optional adapter, never the foundation.
- No network in the deterministic scan/audit path.
- No secret reads.
- Non-secret content hashing is allowed only to prove freshness; GroundAtlas does
  not store source content in generated maps.
- No source mutation.
- No generated-doc authority.
- CI gates must consume machine-readable outputs rather than relying on a human
  reading a dashboard.
