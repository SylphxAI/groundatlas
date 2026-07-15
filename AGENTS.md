# groundatlas — local agent notes only

Doctrine and fleet delivery law live in the **host always-on constitution**
(`~/.grok/AGENTS.md` / Doctrine template). This file must **not** restate,
weaken, or fork that law (including PR-vs-direct-trunk delivery).

Local truth: `PROJECT.md`, `.doctrine/project.json` when present.

## Boundary hazards

- GroundAtlas generated output is not SSOT. Never move project truth into
- The CLI must not read secrets or `.env` files.
- The CLI must not mutate source files, ADRs, schemas, tests, `AGENTS.md`, or
- Keep writes bounded to the configured output directory, plus

## Local commands

- `bun install`
- `bun run typecheck`
- `bun test`
- `bun run lint`
- `bun run build`
- `bun run check`
- `bun run src/cli.ts update`
- `bun run src/cli.ts audit`
- Prefer the **narrowest** affected check before full workspace runs.
- Report layers honestly: local diff · trunk FF · deploy · prod proof (do not collapse).

## Validation notes

- Prefer the **narrowest** affected check before full workspace runs.
- Report layers honestly: local diff · trunk FF · deploy · prod proof (do not collapse).
