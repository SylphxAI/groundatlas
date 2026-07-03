# Fleet Adoption Contract

This is the rulebook for rolling GroundAtlas into many repositories without
creating a second documentation regime or a new drift surface.

## Adoption promise

A repository is GroundAtlas-ready when a clean checkout can run the tool, produce
a deterministic map, audit the non-SSOT boundary, and tell humans/agents exactly
which canonical files to inspect before changing behavior.

## Repository prerequisites

Every commercial-grade repository should expose these files or explain why the
capability is not applicable. SylphxAI repositories may use `.doctrine/project.json`
as an internal adapter, but GroundAtlas public adoption must stay vendor-neutral:

| File/surface | Required | Purpose |
| --- | --- | --- |
| `AGENTS.md` | Preferred | Tool-neutral agent entry point and local hazards. Tool-specific adapters such as `CLAUDE.md`, `.cursor/rules`, or Copilot instructions are optional detected inputs. |
| `PROJECT.md` | Yes | Human-readable project identity, lifecycle, owner boundary, public surfaces, delivery proof. |
| Machine project manifest | Yes for fleet/commercial governance | Prefer `project.manifest.json`; `groundatlas.project.json` and `.project/manifest.json` are compatibility aliases; ecosystem adapters such as `.doctrine/project.json` are recognized but not required. |
| `README.md` | Yes | Public start-here contract. |
| `docs/specs/**` or `DESIGN.md` | Yes for production/commercial work | Product intent and acceptance contracts. |
| `docs/adr/**` | Yes once durable decisions exist | Material decisions and trade-offs. |
| `package.json` / equivalent manifest | Yes when the repo has a package/app/runtime | Commands, exports, dependency surface. |
| Tests/evals | Yes | Behavior proof. |
| CI workflow | Yes | Machine gate for validation. |
| `SECURITY.md` | Yes for public or customer-facing repos | Vulnerability reporting and security expectations. |
| Runbooks | Required for release/ops paths | Repeatable operational procedure. |

## Standard rollout steps

1. Confirm the repo's local truth files above.
2. Install or run GroundAtlas from the published package once npm registry
   readback exists. Until then, use the repository checkout only for dogfooding
   and do not claim fleet package adoption complete.
3. Run `ga init` if the repo has no config.
4. Run `ga update` to generate `.groundatlas/**`.
5. Run `ga audit` locally.
6. Run `ga fleet <repo> --require-atlas --json` to produce a machine-readable
   adopted/warning/blocked report.
7. Add `ga update && ga audit && ga fleet . --require-atlas` or an equivalent package script to CI only after
   the generated output is reproducible and the repo has clear ownership of all
   required truth homes.
8. Do not manually edit `.groundatlas/**`; change canonical sources and regenerate.

## CI gate policy

A useful fleet gate must be machine-checkable:

- fail on missing `PROJECT.md` or any accepted machine project manifest for repos that opt into fleet/commercial governance;
- fail when a neutral machine project manifest is malformed or declares
  `adoption.status: "blocked"`;
- report recognized ecosystem manifests such as `.doctrine/project.json` under
  `manifestAdapters`, not as the public default when a neutral manifest exists;
- fail when generated files lose their non-SSOT banner;
- fail when `atlas.json` uses the wrong schema version;
- fail when the atlas records error-level source risks;
- fail when `ga fleet . --require-atlas --json` reports `blocked`;
- warn, then later fail, on missing specs/ADRs/tests/CI/security as each repo
  reaches commercial-grade lifecycle.

## Rollout phases

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| Dogfood | `SylphxAI/groundatlas` | `bun run check`, package smoke, release preflight, and generated map audit pass. |
| Pilot | 1-2 internal repos | Tool finds real orientation value without source mutation or secret reads. |
| Fleet baseline | All active repos | Required truth homes exist; maps generated; warnings triaged. |
| Fleet gate | Production/commercial repos | CI enforces audit and freshness policy. |
| Public library | npm consumers | Registry readback, clean install smoke, provenance/SBOM evidence, docs updated. |

## Definition of done for fleet use

- The package is published or internally pinned with clear provenance.
- Each repo keeps canonical truth in its existing owners.
- `.groundatlas/**` is deletable and reproducible.
- A new agent can answer "what must I read first?" from the generated map, then
  inspect the linked truth homes.
- CI catches drift that a human reviewer would otherwise catch manually.
