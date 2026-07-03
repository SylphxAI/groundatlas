# Architecture

GroundAtlas uses a small clean-architecture split:

- `src/domain/` owns data types, source classification rules, schema constants,
  truth-home shapes, and orientation types.
- `src/infrastructure/` owns filesystem, non-secret file hashing, and git
  adapters.
- `src/application/` owns scan, generate, audit, explain, impact, and config use
  cases.
- `src/renderers/` owns Markdown rendering.
- `src/cli/` and `src/cli.ts` expose the command-line interface.

The domain and application layers do not depend on CLI argument parsing. The CLI
is a thin adapter over application use cases.

## Why deterministic first

The product avoids LLM extraction in the core path so users can trust the
boundary, rebuild output in CI, inspect exact source paths, and run the tool
without model keys. LLM-assisted claim extraction can be added later as an
optional adapter over the deterministic source manifest.

## Truth and freshness model

`scanRepository` builds an `AtlasMap` with:

- source entries classified by owning truth-home type;
- SHA-256 hashes for non-secret files so audits can detect stale generated maps;
- a fact-scoped SSOT model;
- an orientation route that tells agents what to read first;
- public surfaces, validation commands, and risks.

`auditAtlas` validates generated artifacts and re-scans the repository. It fails
when the persisted atlas no longer matches the current deterministic scan.
