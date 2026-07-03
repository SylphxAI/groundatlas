# Source Truth Model

GroundAtlas uses a **fact-scoped SSOT** model: every durable fact has one owning
truth home, and generated GroundAtlas output is never that owner.

Generated files answer: "Where should I look?" They do not answer: "What is the
truth if sources disagree?" If sources disagree, fix the owning source and then
rerun `ga update`.

## Required reading order

Use this order before making durable changes in any repository that adopts
GroundAtlas:

| Order | Read | Required | What it owns |
| --- | --- | --- | --- |
| 1 | `AGENTS.md` preferred; tool-specific adapters detected when present | Yes | Local agent adapter and repo-specific operating constraints without tying the project to a single AI vendor/tool. |
| 2 | `PROJECT.md` + machine project manifest (`project.manifest.json`, `groundatlas.project.json`, `.project/manifest.json`, or recognized adapter) | Yes | Project identity, lifecycle, owner boundary, public surfaces, adoption state, delivery proof. |
| 3 | `README.md` | Yes | Public product promise, install path, and human start-here contract. |
| 4 | `docs/specs/**`, `DESIGN.md`, `design.md` | Yes for commercial projects | Product intent, operating contracts, adoption rules, design constraints. |
| 5 | `docs/adr/**` | Yes for durable decisions | Architecture/product/security/commercial decisions and trade-offs. |
| 6 | `package.json`, schemas, migrations, exported types | Yes when present | Commands, package surface, data/API contracts, machine-checkable boundaries. |
| 7 | `src/**`, `lib/**`, `test/**`, `tests/**`, evals | Yes | Implemented behavior and behavior proof. |
| 8 | `.github/workflows/**`, `docs/runbooks/**`, `SECURITY.md`, `CHANGELOG.md` | Yes | Validation automation, release operations, vulnerability reporting, support/release status. |
| 9 | `.groundatlas/**` | Optional, last | Generated navigation only. Never SSOT. |

## Is `design.md` truth?

Yes, but only for **design intent**. A design document is not a universal final
authority. Durable decisions belong in ADRs; machine contracts belong in
schemas/types/package exports; implemented behavior belongs in source and tests.
If `design.md` says one thing and code/tests/ADRs say another, GroundAtlas should
surface the conflict instead of pretending the generated map can decide it.

## Truth-home matrix

| Fact type | Canonical owner | GroundAtlas role |
| --- | --- | --- |
| Project identity and boundary | `PROJECT.md`, `project.manifest.json`, `groundatlas.project.json`, `.project/manifest.json`, or recognized adapters such as `.doctrine/project.json` | Link, summarize, and flag missing files. |
| Durable decisions | `docs/adr/**` | Route humans/agents to the active decision trail. |
| Product intent and operating rules | `docs/specs/**`, `DESIGN.md` | Make intent discoverable and compare it to implementation surfaces. |
| Public package/CLI surface | `package.json`, exported types, CLI help | Index commands, exports, and validation scripts. |
| Data/API contracts | schemas, migrations, domain types | Classify as machine-checkable truth homes. |
| Runtime behavior | source code | Point to implementation; do not rewrite or infer hidden behavior. |
| Expected behavior | tests/evals | Point to proof and regression gates. |
| Delivery and release truth | workflows, registry readback, changelog, runbooks | Separate local readiness from published/released proof. |
| Security/support | `SECURITY.md`, security docs/runbooks | Surface reporting and handling routes. |
| Generated navigation | `.groundatlas/**` | Deletable, reproducible map; never source truth. |

## Conflict rule

1. Identify the fact being disputed.
2. Identify the owning truth home for that fact.
3. Fix the owner, not the generated map.
4. Add or update tests/schemas/ADRs/specs if the owner is incomplete.
5. Run the narrowest relevant validation.
6. Run `ga update` and `ga audit`.

## Non-negotiables

- GroundAtlas must not read `.env`, private key, secret, or credential-bearing files.
- GroundAtlas must not mutate source files, ADRs, specs, schemas, tests,
  `AGENTS.md`, tool-specific agent adapters, or machine project manifests.
- GroundAtlas must not require a model key, network call, or private vendor
  service for the deterministic scan/audit path.
- Generated output must be safe to delete and regenerate.
