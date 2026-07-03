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
