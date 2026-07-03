# Architecture

GroundAtlas uses a small clean-architecture split:

- `src/domain/` owns data types and source classification rules.
- `src/infrastructure/` owns filesystem and git adapters.
- `src/application/` owns scan, generate, audit, explain, impact, and config use
  cases.
- `src/renderers/` owns Markdown rendering.
- `src/cli/` and `src/cli.ts` expose the command-line interface.

The domain and application layers do not depend on CLI argument parsing. The CLI
is a thin adapter over application use cases.

## Why deterministic first

The initial product avoids LLM extraction so users can trust the boundary,
rebuild output in CI, and inspect exact source paths. LLM-assisted claim
extraction can be added later as an optional adapter over the deterministic
source manifest.
