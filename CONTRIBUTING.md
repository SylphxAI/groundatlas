# Contributing to GroundAtlas

GroundAtlas is open source and welcomes issues and pull requests.

## Development setup

```sh
bun install
bun run check
```

## Contribution rules

- Preserve the non-SSOT boundary: generated maps are derived navigation aids.
- Keep writes bounded to the configured output directory and init config file.
- Add or update tests for behavior changes.
- Do not introduce network calls, model/provider calls, or tracing without a
  spec and explicit privacy/security review.
- Do not add package publishing until CI-owned provenance and registry readback
  exist.

## Pull request checklist

- [ ] `bun run check` passes.
- [ ] Public CLI behavior is documented.
- [ ] Permission/write boundary is unchanged or explicitly documented.
- [ ] Generated output still declares it is not a source of truth.
