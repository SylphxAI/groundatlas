# Project Control File Guide

A GroundAtlas project control file is a small vendor-neutral manifest that lets a
repository describe itself without adopting any company's internal doctrine.

Use one file per project when a repo needs machine-readable identity, public
surfaces, validation commands, and adoption status.

## Preferred path

```text
project.manifest.json
```

Also recognized:

- `groundatlas.project.json`
- `.project/manifest.json`
- ecosystem adapters such as `.doctrine/project.json`

GroundAtlas treats `project.manifest.json` as the public, vendor-neutral
contract. Ecosystem files such as `.doctrine/project.json` are adapters: they can
prove a local repo is discoverable, but they are not the public default.

## Standalone validation

Validate one manifest without generating `.groundatlas/**`:

```sh
ga manifest project.manifest.json --json
ga manifest validate .doctrine/project.json --json
```

The explicit-path JSON shape is:

```json
{ "schemaVersion": 1, "report": { "path": "project.manifest.json", "valid": true } }
```

Running without a path discovers the repository's manifests and preserves the
same priority as `ga fleet`: neutral manifests first, ecosystem adapters second.
That JSON shape is:

```json
{ "schemaVersion": 1, "selected": {}, "discovered": [], "adapters": [] }
```

The command is intentionally read-only. It is the first public validator surface
for the future vendor-neutral manifest/control-plane library; it does not make
GroundAtlas the SSOT for project identity.

## Minimal example

```json
{
  "schemaVersion": 1,
  "project": {
    "id": "example-service",
    "name": "Example Service",
    "summary": "A source-grounded service with explicit project truth homes.",
    "lifecycle": "production"
  },
  "adoption": {
    "status": "adopted"
  }
}
```

## What belongs here

- Stable project identity.
- Lifecycle and visibility.
- Public surfaces.
- Validation commands.
- GroundAtlas adoption status.
- Time-bounded exceptions.

Manifest-declared validation commands are first-class GroundAtlas inputs. Use
them for repos where the correct gate is not a package script, such as Python,
policy, documentation, infrastructure, or schema-only projects. Do not add a
fake `package.json` only to satisfy a fleet gate.

If a repo has both package scripts and neutral manifest commands, GroundAtlas
reports both and de-duplicates exact command strings with package scripts first.
Only the selected highest-priority valid neutral manifest contributes commands;
lower-priority aliases and ecosystem adapters cannot silently fill gaps.

## What does not belong here

- API contracts that should live in schemas/OpenAPI/protobuf/types.
- Architecture decisions that should live in ADRs.
- Product requirements that should live in specs.
- Secrets, tokens, credentials, customer data, or private environment values.
- Generated `.groundatlas/**` output.

## Why this helps multi-project teams

A single neutral manifest per project lets a portfolio dashboard answer:

- Which repos are production vs experimental?
- Which repos have missing truth homes?
- Which repos have GroundAtlas adopted, blocked, warning, or exception states?
- Which commands should CI or agents run before a change is trusted?

The manifest is intentionally small. It should point to truth homes, not copy all
truth into one file.

## Validation in fleet gates

`ga manifest` validates one file, while `ga fleet` validates the selected
manifest and adapters as part of a repository adoption report.

`ga fleet` validates the neutral manifest shape when it sees
`project.manifest.json`, `groundatlas.project.json`, or `.project/manifest.json`.
Invalid schema version, missing project identity, unsupported lifecycle,
invalid URI fields, malformed surfaces, malformed commands, or
`adoption.status: "blocked"` make the repo `blocked`.

Recognized adapters such as `.doctrine/project.json` are checked only for their
adapter contract and reported under `manifestAdapters` in the fleet JSON. The
top-level `manifest` field is the selected manifest used for public governance.
This keeps the public manifest neutral while still letting internal ecosystems
dogfood the same control-plane gate.
