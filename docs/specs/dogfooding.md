# Dogfooding Contract

GroundAtlas must use GroundAtlas on itself before asking other projects to trust
it.

## Current dogfood loop

`bun run check` runs the full self-hosted loop:

1. Typecheck the product source.
2. Run behavior tests against fixture repositories.
3. Run Biome.
4. Validate this repository's local `.doctrine/project.json` adapter.
5. Build the CLI.
6. Run `node dist/cli.js --help`.
7. Run `node dist/cli.js update` on this repository.
8. Run `node dist/cli.js audit` on the generated map, including schema,
   generated/non-SSOT banners, source-owned error risks, and freshness.
9. Run package dry-run checks before publish workflows.
10. Install the packed tarball in a clean temp project and run imported library plus installed CLI smoke tests.

## Dogfood policy

- The GroundAtlas repository carries `groundatlas.config.json` as its own config.
- Generated output remains reproducible and non-authoritative.
- If a feature cannot be used on GroundAtlas itself, it is not ready to be the
  default for customers.
- Any future LLM/MCP adapter must be tested against this repo without exposing
  secrets or requiring private vendor infrastructure.

## Why generated maps are ignored

The default `.groundatlas/` directory is generated output. The repo dogfoods the
CLI by regenerating and auditing it in CI, while canonical project truth remains
in source files, docs, manifests, and tests.

If a downstream repository chooses to commit generated maps, its CI must run
`ga update` and then `ga audit` so stale tracked output cannot pass quietly.
