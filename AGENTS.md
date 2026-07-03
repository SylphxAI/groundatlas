# Agent Instructions — GroundAtlas

Engineering doctrine: https://github.com/SylphxAI/doctrine

Before changing behavior, read:

1. `PROJECT.md` for this repository's goal, lifecycle, boundary, public
   surfaces, and delivery proof.
2. `.doctrine/project.json` for the machine-readable project manifest.
3. The generated `doctrine-router` Agent Skill from `SylphxAI/doctrine` when
   supported; otherwise read doctrine `AGENTS.md`, `PRINCIPLES.md`, `ADR.md`,
   and triggered `standards/*.md`.

This file is a thin runtime adapter. Do not copy enterprise doctrine into this
repository.

## Local commands

- `bun install`
- `bun run typecheck`
- `bun test`
- `bun run lint`
- `bun run build`
- `bun run check`
- `bun run src/cli.ts update`
- `bun run src/cli.ts audit`

## Local hazards

- GroundAtlas generated output is not SSOT. Never move project truth into
  `.groundatlas/`.
- The CLI must not read secrets or `.env` files.
- The CLI must not mutate source files, ADRs, schemas, tests, `AGENTS.md`, or
  `CLAUDE.md`.
- Keep writes bounded to the configured output directory, plus
  `groundatlas.config.json` during `init`.

## Reporting

Separate local diff, commit state, push state, PR/CI state, package publication,
and runtime proof. This initial repository is not yet package-published.
