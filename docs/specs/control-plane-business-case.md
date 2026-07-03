# Control-plane Business Case

This document answers a hard question: should the vendor-neutral
`project.manifest.json` layer become its own open-source control-plane library,
or is it just another JSON file nobody asked for?

## Verdict

There is real business and community value, but **not in the manifest by
itself**.

The valuable product is a small, vendor-neutral control-plane toolkit that lets
humans, CI systems, developer portals, and AI agents answer these questions
across one repo or many repos:

- What is this project?
- Which files own truth?
- What should I read first?
- Which commands prove a change?
- Which repos are production, experimental, blocked, warning, or exception?
- Which generated context is fresh enough to use as navigation?

The manifest is only the entry point. A standalone library is worth extracting
only when it ships with validators, typed loaders, adapters, inventory, and a
clear consumer such as GroundAtlas.


## Who actually needs this

The strongest users are not people who love documentation. They are people who
need repeatable repository decisions before humans, CI, or agents touch code.

| User / buyer | Urgent job | Why they would adopt |
| --- | --- | --- |
| AI-heavy engineering teams | Stop agents from guessing entry points, tests, and truth homes. | A tiny manifest plus `ga audit` is cheaper than repeated wrong edits. |
| Platform / DX teams with many repos | Build a current project inventory without migrating into a full portal first. | One file per repo can feed scorecards, exceptions, and rollout status. |
| Open-source maintainers | Help contributors and automated agents find the right files quickly. | The generated map is useful but deletable, so it does not become a second wiki. |
| Developer-tool builders | Normalize project identity and validation commands across arbitrary repos. | The library gives a typed loader, adapters, and a stable JSON contract. |

Weak users are equally important to name:

| Not a good fit | Reason |
| --- | --- |
| A single tiny repo with one maintainer and no agents. | The manifest may be more ceremony than value. |
| Teams that want a hosted wiki as the source of truth. | GroundAtlas intentionally keeps truth in source-owned files. |
| Enterprises already all-in on one developer portal with perfect catalog hygiene. | They may only need an adapter, not a new control file. |
| Projects unwilling to run CI or validation gates. | The value decays if freshness is not checked repeatedly. |

## Community need

The community rarely asks for "one more manifest." It asks for relief from
painful workflows:

| Pain | Why it matters | What a control-plane library can provide |
| --- | --- | --- |
| New contributors do not know where to start. | Onboarding and drive-by contributions slow down. | A standard read order and project identity file. |
| AI agents guess repository structure. | Agents edit the wrong files, miss tests, or trust stale prose. | Machine-readable truth homes, commands, and non-SSOT boundaries. |
| Multi-repo teams lack consistent project inventory. | Platform teams cannot quickly tell what is production, maintained, deprecated, or blocked. | Fleet inventory from one small manifest per project. |
| Generated docs drift from source. | Teams lose trust in docs and agent context. | Freshness gates and source-owned truth pointers. |
| Existing catalogs are too heavy or org-specific. | Small OSS projects and agent workflows need something lighter than a full developer portal. | A local-first schema/loader that can also adapt into larger systems. |

The community need is strongest when framed as **agent-ready repo control**, not
as a schema.

## Public ecosystem evidence

Public developer tools show that the community adopts manifest/control-plane
primitives when they are tied to useful automation:

| Evidence | What it proves | Implication for GroundAtlas |
| --- | --- | --- |
| Backstage is a large OSS developer-portal project and documents `catalog-info.yaml` as a recommended descriptor file for catalog entities. | Teams want software catalogs and project metadata, but Backstage is a larger portal system. | `project.manifest.json` can be a lighter local-first source that adapters can map into/out of Backstage. |
| OpenSSF Scorecard is an OSS project for security health metrics. | Communities accept scorecards when they turn repo metadata into actionable risk signals. | A future control-plane library should produce adopted/warning/blocked/exception status, not just parse JSON. |
| Dev Containers standardizes `devcontainer.json`. | Developers accept project-local config files when the file unlocks repeatable tooling. | `project.manifest.json` must unlock CLI, CI, agents, and dashboards immediately. |
| Renovate is widely used for dependency automation via repo config. | Repo-local automation config can become standard when it creates ongoing maintenance value. | The library needs recurring value: validation, inventory, PR reports, and adapters. |
| OCI specs show that neutral formats can support broad tooling ecosystems. | A format is valuable when multiple independent tools consume it. | Do not extract a new repo until at least three concrete consumers exist. |

Evidence checked from public GitHub repositories and public docs on 2026-07-03.
These are not claims that those projects solve the same problem; they are proof
that manifest + validator + automation patterns can earn community adoption when
they solve a real workflow.

## Business value

### For open source

- Makes SylphxAI's engineering taste visible through a reusable primitive.
- Lets the community improve adapters, schema fields, examples, and CI patterns.
- Creates a neutral foundation that other tools can consume without depending on
  SylphxAI Doctrine or GroundAtlas.
- Builds trust because source-owned truth remains outside generated artifacts.

### For a future company product

The free core can stay open while commercial surfaces build around aggregation,
policy, and operations:

| Open core | Potential commercial layer |
| --- | --- |
| Schema, parser, validator, CLI, adapters | Hosted fleet dashboard |
| Local inventory JSON | Org-wide project health history |
| GitHub Action | Managed policy packs and compliance evidence |
| Exception records | Approval workflows, audit trails, SLOs |
| GroundAtlas integration | Private repo onboarding and agent-readiness reports |

The monetizable value is not "we own a manifest." It is **portfolio visibility
and safer automation at scale**.

## Practical usage scenarios

### 1. Single open-source repository

A maintainer adds:

```text
project.manifest.json
```

Then contributors and agents can run:

```sh
project-manifest validate
npx groundatlas update
npx groundatlas audit
```

Expected outcome:

- contributors find docs/specs/tests faster;
- agents know the validation command;
- generated maps stay non-authoritative and fresh.

### 2. Multi-repo startup or platform team

A team has 50 repos. Every repo carries one `project.manifest.json`.

A central inventory job can produce:

```sh
project-manifest inventory ~/src --json
project-manifest score ~/src
```

Expected outcome:

- production vs experimental repos are visible;
- missing tests/specs/CI/security files are visible;
- exceptions have owners and expiry dates;
- platform teams know which repos are agent-ready.

### 3. AI coding agent runtime

Before editing code, an agent loads the manifest and GroundAtlas map:

1. read `project.manifest.json`;
2. read `AGENTS.md` if present;
3. inspect specs/ADRs/source/tests linked by the manifest and atlas;
4. make the change;
5. run declared validation commands;
6. run `ga update && ga audit`.

Expected outcome:

- fewer wrong-entry edits;
- fewer missing validation steps;
- clearer handoffs from agent to maintainer.

### 4. Developer portal adapter

A company already has Backstage or another catalog. It should not be forced to
rename everything.

A library adapter can map:

```text
catalog-info.yaml -> normalized project manifest
.doctrine/project.json -> normalized project manifest
package.json/workspaces -> project hints
```

Expected outcome:

- existing catalogs remain sources or adapters;
- GroundAtlas consumes normalized metadata without owning the portal.

## What the library should actually ship

A standalone repo is only worth opening if it ships more than a schema:

1. `project.manifest.json` JSON schema.
2. TypeScript types and loader.
3. CLI validator: `project-manifest validate`.
4. Inventory command: `project-manifest inventory <paths...> --json`.
5. Score command: `project-manifest score`.
6. Adapter interface.
7. Built-in adapters:
   - `project.manifest.json`;
   - `.doctrine/project.json`;
   - `package.json`/workspace hints;
   - Backstage `catalog-info.yaml` as a later adapter.
8. GitHub Action for validation.
9. Machine-readable exception records.
10. GroundAtlas integration.


## How people would use the library

The future standalone library should be useful in three modes. If any mode is
missing, the library is probably not worth extracting yet.

### CLI mode

```sh
project-manifest init
project-manifest validate
project-manifest inventory ./services/* --json > inventory.json
project-manifest score ./services/*
```

This serves maintainers and platform teams that want immediate local or CI value
without writing integration code.

### CI / GitHub Action mode

```yaml
- uses: groundatlas/project-manifest-action@v1
  with:
    paths: ./services/*
    require-validation-command: true
    fail-on-expired-exceptions: true
```

This turns the manifest from documentation into a recurring gate: missing truth
homes, stale exceptions, or absent validation commands fail before drift spreads.

### Library / adapter mode

```ts
import { loadProjectManifest, inventoryProjects } from "project-manifest";

const manifest = await loadProjectManifest(process.cwd());
const inventory = await inventoryProjects(["./apps/*", "./packages/*"]);
```

This serves GroundAtlas, developer portals, MCP servers, agent runtimes, and
internal dashboards. They can consume one normalized model while the original
repo keeps its own source files and ecosystem-specific config.

## Adoption path

| Phase | What ships | Evidence required |
| --- | --- | --- |
| 0. Embedded spec | GroundAtlas owns schema/example/docs. | `bun run check`, packed package includes schema/example/docs. |
| 1. Internal dogfood | SylphxAI repos add `project.manifest.json` or adapters. | At least 3 repos produce useful inventory without private-only fields. |
| 2. External pilot | One non-Sylphx open-source repo uses the manifest and validator. | Maintainer feedback shows real onboarding or CI value. |
| 3. Extract library | New repo/package ships schema, CLI, loader, adapters, action. | GroundAtlas, Doctrine adapter, and GitHub Action consume the package. |
| 4. Fleet dashboard | Inventory/scorecard becomes visible and recurring. | Users return for repo health, not just first-time setup. |

## New repository decision gate

Do **not** open a new public repo just because the concept sounds clean.

Open the standalone library when all are true:

1. GroundAtlas consumes the package instead of local schema code.
2. A Doctrine adapter emits/loads the neutral manifest without becoming public
   doctrine.
3. A GitHub Action or CLI validator exists and is useful without GroundAtlas.
4. At least one external repo or neutral fixture proves the manifest is not
   SylphxAI-shaped.
5. The README can demo value in under 60 seconds.

If those gates are not met, keep the schema inside GroundAtlas and keep learning.

## Relationship to SylphxAI Doctrine

The library should **not** replace SylphxAI Doctrine.

Correct layering:

```text
SylphxAI Doctrine
  -> optional adapter
project.manifest.json / normalized manifest model
  -> consumed by
GroundAtlas / CI / agents / future dashboard
```

Doctrine remains SylphxAI's internal operating doctrine. The public library owns
only neutral project metadata, adapters, validation, and inventory.

## Risks and anti-claims

- A schema-only repo will not earn stars.
- A manifest that copies truth from specs/ADRs/source creates SSOT drift.
- A public default that depends on SylphxAI Doctrine creates vendor lock-in.
- A dashboard without repeated CI/inventory value becomes shelfware.
- Claims about AI semantics, citation graphs, or fleet health must wait until
  implementation and readback prove them.

## Final recommendation

Yes, plan for a standalone open-source control-plane library, but sequence it as
an extraction from proven use rather than a premature new standard.

GroundAtlas should remain the first killer consumer. The next strongest step is
not opening a repo; it is proving `project.manifest.json` across several real
repositories and building the validator/inventory/action surface that makes the
manifest useful every week.
