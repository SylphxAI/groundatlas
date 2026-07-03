# Developer Experience Guide

GroundAtlas should feel boring, fast, and safe in a developer workflow.

## Package scripts

Recommended package scripts:

```json
{
  "scripts": {
    "groundatlas:update": "ga update",
    "groundatlas:audit": "ga audit",
    "check": "npm run test && npm run groundatlas:update && npm run groundatlas:audit"
  }
}
```

If a repo commits `.groundatlas/**`, CI should fail when `ga update` changes the
tracked generated output. If a repo ignores `.groundatlas/**`, CI should still run
`ga update && ga audit` so stale local maps cannot hide drift.

## PR workflow

```sh
ga impact --since origin/main
ga explain "release workflow"
ga audit
```

Use the output to route reviewers and agents to owning files. Do not edit the
generated map by hand.

## Safe defaults

- No model key required.
- No network required in deterministic scan/audit path.
- No source mutation.
- Secret-looking paths are skipped.
- Writes are bounded to the configured output directory and `groundatlas.config.json`
  during `init`.
